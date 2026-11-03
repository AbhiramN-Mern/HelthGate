import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { connectDB } from "../config/db.js";
import PaymentModel from "../models/payment.model.js";
import AppointmentModel from "../models/appointment.model.js";
import WebhookEventModel from "../models/webhookEvent.model.js";
import OutboxEventModel from "../models/outboxEvent.model.js";
import UserModel from "../models/user.model.js";
import DoctorModel from "../models/doctor.model.js";

import { RazorpayGateway } from "../infrastructure/payment/razorpay/RazorpayGateway.js";
import { MockPaymentGateway } from "../infrastructure/payment/mock/MockPaymentGateway.js";
import { MongooseTransactionManager } from "../infrastructure/transactions/MongooseTransactionManager.js";
import { MongoPaymentRepository } from "../repositories/implementations/MongoPaymentRepository.js";
import { MongoAppointmentRepository } from "../repositories/implementations/MongoAppointmentRepository.js";
import { MongoNotificationRepository } from "../repositories/implementations/MongoNotificationRepository.js";
import { MongoDoctorRepository } from "../repositories/implementations/MongoDoctorRepository.js";
import { MongoUserRepository } from "../repositories/implementations/MongoUserRepository.js";
import { PaymentService } from "../services/payment.service.js";
import { PaymentReconciliationWorker } from "../workers/paymentReconciliationWorker.js";
import { OutboxProcessorWorker } from "../workers/outboxProcessorWorker.js";

async function runAudit() {
  console.log("=========================================================");
  console.log("HEALTHGATE PRODUCTION READINESS AUDIT: EMPIRICAL EVIDENCE");
  console.log("=========================================================\n");

  await connectDB();
  const db = mongoose.connection.db!;

  // ----------------------------------------------------------------------
  // SCENARIO 11: MONGODB INDEXES VERIFICATION
  // ----------------------------------------------------------------------
  console.log("--- SCENARIO 11: MongoDB Index Verification ---");
  const collections = ["appointments", "payments", "webhookevents", "outboxevents"];
  for (const col of collections) {
    const indexes = await db.collection(col).indexes();
    console.log(`\nCollection [${col}] indexes:`);
    for (const idx of indexes) {
      console.log(`  * Name: ${idx.name} | Key: ${JSON.stringify(idx.key)} | Unique: ${Boolean(idx.unique)} | Partial: ${JSON.stringify(idx.partialFilterExpression || null)}`);
    }
  }

  // ----------------------------------------------------------------------
  // SCENARIO 1: RECONCILIATION WORKER ON CAPTURED PAYMENT WITHOUT WEBHOOK
  // ----------------------------------------------------------------------
  console.log("\n--- SCENARIO 1: PaymentReconciliationWorker Behavior on Interrupted Captured Payment ---");
  const paymentRepo = new MongoPaymentRepository();
  const apptRepo = new MongoAppointmentRepository();
  const notifRepo = new MongoNotificationRepository();
  const docRepo = new MongoDoctorRepository();
  const userRepo = new MongoUserRepository();
  const txManager = new MongooseTransactionManager();
  const mockGateway = new MockPaymentGateway();
  const razorpayGateway = new RazorpayGateway();

  // Create an appointment and simulate payment that was captured at gateway, but webhook never reached server
  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
  const testAppt = await AppointmentModel.create({
    patient: new Types.ObjectId(),
    doctor: new Types.ObjectId(),
    department: "General",
    appointmentDate: new Date("2026-12-15"),
    timeSlot: "10:00 AM",
    normalizedDate: "2026-12-15",
    normalizedTimeSlot: "10:00 AM",
    status: "cancelled", // Cancelled by ReservationCleanupWorker
    bookingExpiresAt: twentyMinsAgo,
  });

  const testCapturedPayment = await PaymentModel.create({
    bookingId: testAppt._id,
    patientId: testAppt.patient,
    amount: 500,
    currency: "INR",
    status: "PENDING", // Remains PENDING locally because webhook was lost
    provider: "RAZORPAY",
    providerOrderId: `order_lost_webhook_${Date.now()}`,
    providerPaymentId: null, // Unknown locally
    createdAt: twentyMinsAgo,
  });

  const reconWorker = new PaymentReconciliationWorker(paymentRepo, razorpayGateway);
  const reconStats = await reconWorker.reconcileInterruptedPayments();
  const postReconPayment = await PaymentModel.findById(testCapturedPayment._id);

  console.log(`Reconciliation result: pendingAbandoned=${reconStats.pendingAbandoned}`);
  console.log(`Payment status after reconciliation: ${postReconPayment?.status}`);
  console.log(`Payment failureReason: ${postReconPayment?.failureReason}`);
  const gatewayHasQueryMethod = typeof (razorpayGateway as any).fetchPayment === "function" || typeof (razorpayGateway as any).fetchOrder === "function";
  console.log(`Does RazorpayGateway implement fetchPayment or fetchOrder? ${gatewayHasQueryMethod}`);

  // Cleanup scenario 1
  await AppointmentModel.deleteOne({ _id: testAppt._id });
  await PaymentModel.deleteOne({ _id: testCapturedPayment._id });

  // ----------------------------------------------------------------------
  // SCENARIO 3: WEBHOOK SIGNATURE HANDLING
  // ----------------------------------------------------------------------
  console.log("\n--- SCENARIO 3: Webhook Signature Handling ---");
  const testSecret = "webhook_secret_key_12345";
  const testPayload = { event: "payment.captured", payload: { payment: { entity: { id: "pay_test_sig", order_id: "order_test_sig" } } } };
  const rawBody = JSON.stringify(testPayload);

  // 3a. Valid Signature
  const validSig = crypto.createHmac("sha256", testSecret).update(rawBody).digest("hex");
  const validCheck = razorpayGateway.verifyWebhookSignature(rawBody, validSig, testSecret);
  console.log(`3a. Valid signature check result: ${validCheck}`);

  // 3b. Invalid Signature
  const invalidSig = "0000000000000000000000000000000000000000000000000000000000000000";
  const invalidCheck = razorpayGateway.verifyWebhookSignature(rawBody, invalidSig, testSecret);
  console.log(`3b. Invalid signature check result: ${invalidCheck}`);

  // 3c. Incorrect Secret
  const incorrectSecretCheck = razorpayGateway.verifyWebhookSignature(rawBody, validSig, "wrong_secret");
  console.log(`3c. Incorrect secret check result: ${incorrectSecretCheck}`);

  // 3d. Missing Signature behavior in PaymentService
  const testPaymentService = new PaymentService(paymentRepo, apptRepo, docRepo, notifRepo, userRepo, mockGateway, undefined, txManager);
  let missingSigPassed = false;
  try {
    const res = await testPaymentService.handleWebhook({
      signature: undefined, // MISSING
      payload: { event: "dummy.event", payload: {} },
      rawBody,
    });
    missingSigPassed = res.received === true;
  } catch (err: any) {
    missingSigPassed = false;
  }
  console.log(`3d. Missing signature: does handleWebhook proceed when signature is undefined? ${missingSigPassed}`);

  // ----------------------------------------------------------------------
  // SCENARIO 4: REFUND.PROCESSED AND REFUND.FAILED OUT-OF-ORDER HANDLING
  // ----------------------------------------------------------------------
  console.log("\n--- SCENARIO 4: refund.processed and refund.failed (Duplicate & Out-of-Order) ---");
  const refundAppt = await AppointmentModel.create({
    patient: new Types.ObjectId(),
    doctor: new Types.ObjectId(),
    department: "General",
    appointmentDate: new Date("2026-12-15"),
    timeSlot: "11:00 AM",
    status: "cancelled",
  });

  const refundPayment = await PaymentModel.create({
    bookingId: refundAppt._id,
    patientId: refundAppt.patient,
    amount: 500,
    currency: "INR",
    status: "REFUND_PENDING",
    refundStatus: "PENDING",
    refundId: `rfnd_test_flow_${Date.now()}`,
    provider: "RAZORPAY",
    providerOrderId: `order_refund_flow_${Date.now()}`,
    providerPaymentId: `pay_refund_flow_${Date.now()}`,
  });

  // 4a. refund.processed arrives
  await testPaymentService.handleWebhook({
    eventId: `evt_rfnd_proc_${Date.now()}`,
    payload: {
      event: "refund.processed",
      payload: { refund: { entity: { id: refundPayment.refundId, payment_id: refundPayment.providerPaymentId } } },
    },
  });
  const afterProc = await PaymentModel.findById(refundPayment._id);
  console.log(`4a. Status after refund.processed: ${afterProc?.status}, refundStatus: ${afterProc?.refundStatus}`);

  // 4b. Out-of-order delayed refund.failed arrives after refund.processed
  await testPaymentService.handleWebhook({
    eventId: `evt_rfnd_fail_delayed_${Date.now()}`,
    payload: {
      event: "refund.failed",
      payload: { refund: { entity: { id: refundPayment.refundId, payment_id: refundPayment.providerPaymentId, error_description: "Delayed gateway error" } } },
    },
  });
  const afterDelayedFail = await PaymentModel.findById(refundPayment._id);
  console.log(`4b. Status after delayed refund.failed: ${afterDelayedFail?.status}, refundStatus: ${afterDelayedFail?.refundStatus} (Did it overwrite REFUNDED? ${afterDelayedFail?.status === "REFUND_FAILED"})`);

  // Cleanup scenario 4
  await AppointmentModel.deleteOne({ _id: refundAppt._id });
  await PaymentModel.deleteOne({ _id: refundPayment._id });

  // ----------------------------------------------------------------------
  // SCENARIO 9: TRANSACTION MANDATORY IN PRODUCTION VERIFICATION
  // ----------------------------------------------------------------------
  console.log("\n--- SCENARIO 9: Transactions Mandatory in Production ---");
  const oldNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  let txErrorCaught: string | null = null;
  // Disconnect mock test
  const disconnectedTxManager = new MongooseTransactionManager();
  // Temporarily set readyState to 0
  const realReadyState = mongoose.connection.readyState;
  (mongoose.connection as any).readyState = 0;

  try {
    await disconnectedTxManager.executeTransaction(async () => "ok");
  } catch (err: any) {
    txErrorCaught = err.message || String(err);
  } finally {
    (mongoose.connection as any).readyState = realReadyState;
    process.env.NODE_ENV = oldNodeEnv;
  }
  console.log(`In production with disconnected DB, was TransactionNotSupportedError thrown? ${Boolean(txErrorCaught?.includes("disconnected"))}`);
  console.log(`Error message: ${txErrorCaught}`);

  // ----------------------------------------------------------------------
  // SCENARIO 14: ENVIRONMENT VARIABLES & LOGGING AUDIT
  // ----------------------------------------------------------------------
  console.log("\n--- SCENARIO 14: Environment Variables & Insecure Defaults ---");
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "undefined (insecure default)"}`);
  console.log(`PORT: ${process.env.PORT}`);
  console.log(`PAYMENT_GATEWAY: ${process.env.PAYMENT_GATEWAY}`);
  console.log(`RAZORPAY_KEY_ID present: ${Boolean(process.env.RAZORPAY_KEY_ID)}`);
  console.log(`RAZORPAY_KEY_SECRET present: ${Boolean(process.env.RAZORPAY_KEY_SECRET)}`);
  console.log(`RAZORPAY_WEBHOOK_SECRET present: ${Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)}`);
  console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL}`);
  console.log(`JWT_SECRET present: ${Boolean(process.env.JWT_SECRET)}`);

  console.log("\n=========================================================");
  console.log("AUDIT SCRIPT EXECUTION FINISHED");
  console.log("=========================================================");
  await mongoose.disconnect();
}

runAudit().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});

