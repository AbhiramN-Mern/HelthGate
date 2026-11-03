import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";

import { connectDB } from "../config/db.js";
import PaymentModel from "../models/payment.model.js";
import AppointmentModel from "../models/appointment.model.js";
import WebhookEventModel from "../models/webhookEvent.model.js";
import OutboxEventModel from "../models/outboxEvent.model.js";
import UserModel from "../models/user.model.js";
import DoctorModel from "../models/doctor.model.js";
import HospitalModel from "../models/hospital.model.js";
import NotificationModel from "../models/notification.model.js";
import HospitalDoctorModel from "../models/hospitalDoctor.model.js";
import PatientModel from "../models/patient.model.js";

// Side-effect model imports to ensure schemas are registered in Mongoose connection
import "../models/hospital.model.js";
import "../models/hospitalDoctor.model.js";
import "../models/patient.model.js";
import "../models/user.model.js";
import "../models/doctor.model.js";
import "../models/appointment.model.js";
import "../models/payment.model.js";
import "../models/notification.model.js";

import { MongoPaymentRepository } from "../repositories/implementations/MongoPaymentRepository.js";
import { MongoAppointmentRepository } from "../repositories/implementations/MongoAppointmentRepository.js";
import { MongoNotificationRepository } from "../repositories/implementations/MongoNotificationRepository.js";
import { MongoDoctorRepository } from "../repositories/implementations/MongoDoctorRepository.js";
import { MongoUserRepository } from "../repositories/implementations/MongoUserRepository.js";

import { MongooseTransactionManager } from "../infrastructure/transactions/MongooseTransactionManager.js";
import { MockPaymentGateway } from "../infrastructure/payment/mock/MockPaymentGateway.js";
import { RazorpayGateway } from "../infrastructure/payment/razorpay/RazorpayGateway.js";
import { PaymentService } from "../services/payment.service.js";
import { OutboxProcessorWorker } from "../workers/outboxProcessorWorker.js";
import { PaymentReconciliationWorker } from "../workers/paymentReconciliationWorker.js";

describe("Phase 3: Payment Consistency, Idempotency & Transactional Integrity Integration Tests", () => {
  let paymentRepo: MongoPaymentRepository;
  let apptRepo: MongoAppointmentRepository;
  let notifRepo: MongoNotificationRepository;
  let docRepo: MongoDoctorRepository;
  let userRepo: MongoUserRepository;
  let txManager: MongooseTransactionManager;
  let mockGateway: MockPaymentGateway;
  let paymentService: PaymentService;

  // Track created test entities for clean teardown
  const createdUserIds: any[] = [];
  const createdDoctorIds: any[] = [];
  const createdApptIds: any[] = [];
  const createdPaymentIds: any[] = [];
  const createdEventIds: string[] = [];

  let testPatientId: string;
  let testDoctorUserId: string;
  let testDoctorId: string;

  before(async () => {
    await connectDB();
    void HospitalModel.schema;
    void NotificationModel.schema;
    void HospitalDoctorModel.schema;
    void PatientModel.schema;

    // Clean up outbox and webhook queues for clean test run
    await OutboxEventModel.deleteMany({}).exec();
    await WebhookEventModel.deleteMany({}).exec();

    paymentRepo = new MongoPaymentRepository();
    apptRepo = new MongoAppointmentRepository();
    notifRepo = new MongoNotificationRepository();
    docRepo = new MongoDoctorRepository();
    userRepo = new MongoUserRepository();
    txManager = new MongooseTransactionManager();
    mockGateway = new MockPaymentGateway();

    paymentService = new PaymentService(
      paymentRepo,
      apptRepo,
      docRepo,
      notifRepo,
      userRepo,
      mockGateway,
      undefined,
      txManager,
    );

    // Create persistent patient user for tests
    const patientUser: any = await UserModel.create({
      name: "Phase3 Test Patient",
      email: `phase3_patient_${Date.now()}@healthgate.test`,
      password: "HashedPassword123!",
      role: "patient",
      isEmailVerified: true,
    });
    testPatientId = String(patientUser._id);
    createdUserIds.push(patientUser._id);

    // Create doctor user and doctor profile
    const docUser: any = await UserModel.create({
      name: "Dr. Phase3 Surgeon",
      email: `phase3_doc_${Date.now()}@healthgate.test`,
      password: "HashedPassword123!",
      role: "doctor",
      isEmailVerified: true,
    });
    testDoctorUserId = String(docUser._id);
    createdUserIds.push(docUser._id);

    const docProfile: any = await DoctorModel.create({
      user: docUser._id,
      specialization: "Cardiology",
      qualification: "MBBS, MD Cardiology",
      licenseNumber: `LIC_PHASE3_${Date.now()}`,
      consultationFee: 750,
      offlineConsultationFee: 950,
      verificationStatus: "verified",
      doctorApprovalStatus: "approved",
    });
    testDoctorId = String(docProfile._id);
    createdDoctorIds.push(docProfile._id);
  });

  after(async () => {
    // Teardown test documents
    if (createdPaymentIds.length) {
      await PaymentModel.deleteMany({ _id: { $in: createdPaymentIds } }).exec();
    }
    if (createdApptIds.length) {
      await AppointmentModel.deleteMany({ _id: { $in: createdApptIds } }).exec();
    }
    if (createdUserIds.length) {
      await UserModel.deleteMany({ _id: { $in: createdUserIds } }).exec();
    }
    if (createdDoctorIds.length) {
      await DoctorModel.deleteMany({ _id: { $in: createdDoctorIds } }).exec();
    }
    if (createdEventIds.length) {
      await WebhookEventModel.deleteMany({ eventId: { $in: createdEventIds } }).exec();
      await OutboxEventModel.deleteMany({ aggregateId: { $in: createdEventIds } }).exec();
    }
    await mongoose.disconnect();
  });

  // Helper to create test appointment in Atlas
  let testApptCounter = 0;
  async function createTestAppointment(status: any = "pending_payment", minutesValid = 10) {
    testApptCounter++;
    const expiresAt = new Date(Date.now() + minutesValid * 60 * 1000);
    const day = String((testApptCounter % 25) + 1).padStart(2, "0");
    const hour = (testApptCounter % 12) + 1;
    const min = String((testApptCounter * 7) % 60).padStart(2, "0");
    const dateStr = `2027-01-${day}`;
    const slotStr = `${String(hour).padStart(2, "0")}:${min} PM`;

    const appt: any = await AppointmentModel.create({
      patient: new Types.ObjectId(testPatientId),
      doctor: new Types.ObjectId(testDoctorId),
      department: "Cardiology",
      appointmentDate: new Date(dateStr),
      timeSlot: slotStr,
      normalizedDate: dateStr,
      normalizedTimeSlot: slotStr,
      status,
      paymentExpiresAt: expiresAt,
      bookingExpiresAt: expiresAt,
      reservationReference: `res_test_${Date.now()}_${testApptCounter}`,
      consultationType: "online",
    });

    createdApptIds.push(appt._id);
    return appt;
  }

  it("1. MongoDB Constraints: Enforces unique providerOrderId and partial unique providerPaymentId", async () => {
    const uniqueOrder = `order_test_uniq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const uniquePayment = `pay_test_uniq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Create initial payment
    const p1: any = await PaymentModel.create({
      bookingId: new Types.ObjectId(),
      patientId: new Types.ObjectId(testPatientId),
      amount: 500,
      currency: "INR",
      status: "PENDING",
      provider: "MOCK",
      providerOrderId: uniqueOrder,
      providerPaymentId: null, // Nullable providerPaymentId
    });
    createdPaymentIds.push(p1._id);

    // Another record with null providerPaymentId and different providerOrderId MUST succeed (partial index)
    const p2: any = await PaymentModel.create({
      bookingId: new Types.ObjectId(),
      patientId: new Types.ObjectId(testPatientId),
      amount: 500,
      currency: "INR",
      status: "PENDING",
      provider: "MOCK",
      providerOrderId: `${uniqueOrder}_diff`,
      providerPaymentId: null,
    });
    createdPaymentIds.push(p2._id);
    assert.ok(p2._id, "Multiple payments with null providerPaymentId are allowed by partial unique index");

    // Duplicate providerOrderId MUST throw E11000
    await assert.rejects(
      async () => {
        await PaymentModel.create({
          bookingId: new Types.ObjectId(),
          patientId: new Types.ObjectId(testPatientId),
          amount: 500,
          currency: "INR",
          status: "PENDING",
          provider: "MOCK",
          providerOrderId: uniqueOrder, // DUPLICATE
          providerPaymentId: null,
        });
      },
      (err: any) => err.code === 11000,
      "Duplicate providerOrderId must trigger MongoDB unique index violation (E11000)",
    );

    // Update p1 with unique providerPaymentId
    await PaymentModel.findByIdAndUpdate(p1._id, { providerPaymentId: uniquePayment });

    // Attempting to set same providerPaymentId on p2 MUST throw E11000
    await assert.rejects(
      async () => {
        await PaymentModel.create({
          bookingId: new Types.ObjectId(),
          patientId: new Types.ObjectId(testPatientId),
          amount: 500,
          currency: "INR",
          status: "SUCCESS",
          provider: "MOCK",
          providerOrderId: `${uniqueOrder}_another`,
          providerPaymentId: uniquePayment, // DUPLICATE
        });
      },
      (err: any) => err.code === 11000,
      "Duplicate non-null providerPaymentId must trigger partial unique index violation (E11000)",
    );
  });

  it("2. Real Replica-Set Transaction Coordination & Atomic Outbox Generation", async () => {
    const appt = await createTestAppointment("pending_payment", 10);
    const orderData = await paymentService.createPaymentOrder({
      patientUserId: testPatientId,
      bookingId: String(appt._id),
    });
    createdPaymentIds.push(orderData.payment._id);

    // Perform verification with live replica-set transaction
    const verifyResult = await paymentService.verifyPayment({
      patientUserId: testPatientId,
      paymentId: String(orderData.payment._id),
      providerOrderId: orderData.order.providerOrderId,
      providerPaymentId: `pay_tx_coord_${Date.now()}`,
    });

    assert.equal(verifyResult.success, true);
    assert.match(verifyResult.message, /verified successfully/i);

    // Verify appointment status updated to confirmed
    const confirmedAppt = await AppointmentModel.findById(appt._id).exec();
    assert.equal(confirmedAppt?.status, "confirmed");

    // Verify payment status updated to SUCCESS
    const successPayment = await PaymentModel.findById(orderData.payment._id).exec();
    assert.equal(successPayment?.status, "SUCCESS");
    assert.ok(successPayment?.providerPaymentId);

    // Verify Outbox event was created within the transaction
    const outboxEvent = await OutboxEventModel.findOne({
      aggregateId: String(appt._id),
      eventType: "APPOINTMENT_CONFIRMED",
    }).exec();

    assert.ok(outboxEvent, "Outbox event for APPOINTMENT_CONFIRMED must be atomically persisted");
    assert.equal(outboxEvent.status, "PENDING");
    createdEventIds.push(String(appt._id));
  });

  it("3. Transaction Rollback: Simulated failure rolls back both appointment and payment updates", async () => {
    const appt = await createTestAppointment("pending_payment", 10);
    const payment = await PaymentModel.create({
      bookingId: appt._id,
      patientId: new Types.ObjectId(testPatientId),
      amount: 750,
      currency: "INR",
      status: "PENDING",
      provider: "MOCK",
      providerOrderId: `order_rollback_${Date.now()}`,
    });
    createdPaymentIds.push(payment._id);

    // Simulate an unexpected crash inside the transaction
    await assert.rejects(
      async () => {
        await txManager.executeTransaction(async (session) => {
          await apptRepo.atomicConfirmPayment(appt._id, new Date(), session);
          await paymentRepo.transitionToSuccess(payment._id, "pay_mock_crash", session);

          // Force an error to trigger transaction rollback
          throw new Error("SIMULATED_DATABASE_OR_WORKER_CRASH");
        });
      },
      /SIMULATED_DATABASE_OR_WORKER_CRASH/,
    );

    // Verify that neither appointment nor payment was updated
    const untouchedAppt = await AppointmentModel.findById(appt._id).exec();
    assert.equal(untouchedAppt?.status, "pending_payment", "Appointment must remain pending_payment after rollback");

    const untouchedPayment = await PaymentModel.findById(payment._id).exec();
    assert.equal(untouchedPayment?.status, "PENDING", "Payment must remain PENDING after rollback");
    assert.equal(untouchedPayment?.providerPaymentId, null);
  });

  it("4. Concurrent Duplicate /verify Requests: Exactly one executes, both return consistent success", async () => {
    const appt = await createTestAppointment("pending_payment", 10);
    const orderData = await paymentService.createPaymentOrder({
      patientUserId: testPatientId,
      bookingId: String(appt._id),
    });
    createdPaymentIds.push(orderData.payment._id);

    const payId = `pay_concurrent_${Date.now()}`;

    // Execute 5 concurrent verification requests simultaneously
    const results = await Promise.all([
      paymentService.verifyPayment({
        patientUserId: testPatientId,
        paymentId: String(orderData.payment._id),
        providerOrderId: orderData.order.providerOrderId,
        providerPaymentId: payId,
      }),
      paymentService.verifyPayment({
        patientUserId: testPatientId,
        paymentId: String(orderData.payment._id),
        providerOrderId: orderData.order.providerOrderId,
        providerPaymentId: payId,
      }),
      paymentService.verifyPayment({
        patientUserId: testPatientId,
        paymentId: String(orderData.payment._id),
        providerOrderId: orderData.order.providerOrderId,
        providerPaymentId: payId,
      }),
    ]);

    // All must report success
    for (const r of results) {
      assert.equal(r.success, true);
    }

    // Appointment must be confirmed exactly once
    const finalAppt = await AppointmentModel.findById(appt._id).exec();
    assert.equal(finalAppt?.status, "confirmed");

    // Exactly 1 outbox event must exist (no duplicate notifications queued)
    const outboxEvents = await OutboxEventModel.find({
      aggregateId: String(appt._id),
      eventType: "APPOINTMENT_CONFIRMED",
    }).exec();
    assert.equal(outboxEvents.length, 1, "Only one outbox confirmation event must be created");
  });

  it("5. Simultaneous Browser Verification and Webhook Arrival: Zero race condition corruption", async () => {
    const appt = await createTestAppointment("pending_payment", 10);
    const orderData = await paymentService.createPaymentOrder({
      patientUserId: testPatientId,
      bookingId: String(appt._id),
    });
    createdPaymentIds.push(orderData.payment._id);

    const providerPaymentId = `pay_simul_${Date.now()}`;
    const webhookEventId = `evt_simul_${Date.now()}`;
    createdEventIds.push(webhookEventId);

    // Fire browser verify and payment.captured webhook at the exact same millisecond
    const [browserRes, webhookRes] = await Promise.all([
      paymentService.verifyPayment({
        patientUserId: testPatientId,
        paymentId: String(orderData.payment._id),
        providerOrderId: orderData.order.providerOrderId,
        providerPaymentId,
      }),
      paymentService.handleWebhook({
        eventId: webhookEventId,
        payload: {
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: providerPaymentId,
                order_id: orderData.order.providerOrderId,
                amount: 75000,
              },
            },
          },
        },
      }),
    ]);

    assert.equal(browserRes.success, true);
    assert.equal(webhookRes.received, true);

    const paymentDoc = await PaymentModel.findById(orderData.payment._id).exec();
    assert.equal(paymentDoc?.status, "SUCCESS");

    const apptDoc = await AppointmentModel.findById(appt._id).exec();
    assert.equal(apptDoc?.status, "confirmed");
  });

  it("6. Webhook Idempotency: Duplicate payment.captured events return duplicate: true and do not reprocess", async () => {
    const appt = await createTestAppointment("pending_payment", 10);
    const orderData = await paymentService.createPaymentOrder({
      patientUserId: testPatientId,
      bookingId: String(appt._id),
    });
    createdPaymentIds.push(orderData.payment._id);

    const eventId = `evt_dedup_${Date.now()}`;
    createdEventIds.push(eventId);
    const providerPaymentId = `pay_dedup_${Date.now()}`;

    const webhookPayload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: providerPaymentId,
            order_id: orderData.order.providerOrderId,
            amount: 75000,
          },
        },
      },
    };

    // First arrival
    const firstDelivery = await paymentService.handleWebhook({
      eventId,
      payload: webhookPayload,
    });
    assert.equal(firstDelivery.received, true);
    assert.equal(firstDelivery.processed, true);

    // Verify WebhookEventModel is marked PROCESSED
    const eventDoc = await WebhookEventModel.findOne({ eventId }).exec();
    assert.equal(eventDoc?.status, "PROCESSED");

    // Second arrival with exact same eventId
    const secondDelivery = await paymentService.handleWebhook({
      eventId,
      payload: webhookPayload,
    });
    assert.equal(secondDelivery.received, true);
    assert.equal((secondDelivery as any).duplicate, true);
    assert.match((secondDelivery as any).message, /already processed/i);
  });

  it("7. Out-of-Order Webhook Protection: Delayed payment.failed cannot overwrite terminal SUCCESS", async () => {
    const appt = await createTestAppointment("pending_payment", 10);
    const orderData = await paymentService.createPaymentOrder({
      patientUserId: testPatientId,
      bookingId: String(appt._id),
    });
    createdPaymentIds.push(orderData.payment._id);

    // First: payment captures successfully
    await paymentService.verifyPayment({
      patientUserId: testPatientId,
      paymentId: String(orderData.payment._id),
      providerOrderId: orderData.order.providerOrderId,
      providerPaymentId: `pay_ordered_${Date.now()}`,
    });

    const successPayment = await PaymentModel.findById(orderData.payment._id).exec();
    assert.equal(successPayment?.status, "SUCCESS");

    // Now an out-of-order delayed payment.failed webhook arrives
    const failedEventId = `evt_failed_delayed_${Date.now()}`;
    createdEventIds.push(failedEventId);

    await paymentService.handleWebhook({
      eventId: failedEventId,
      payload: {
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: `pay_ordered_${Date.now()}`,
              order_id: orderData.order.providerOrderId,
              error_description: "Delayed bank error response",
            },
          },
        },
      },
    });

    // Payment MUST remain SUCCESS (terminal state protected from regressive overwrite)
    const checkPayment = await PaymentModel.findById(orderData.payment._id).exec();
    assert.equal(checkPayment?.status, "SUCCESS", "Terminal SUCCESS state must never be overwritten by payment.failed");
  });

  it("8. Concurrent Refund Locks: Only ONE external refund call made, idempotency key persisted", async () => {
    // Create an expired appointment
    const expiredAppt = await createTestAppointment("pending_payment", -5); // Expired 5 minutes ago
    const orderData = await paymentService.createPaymentOrder({
      patientUserId: testPatientId,
      bookingId: String(expiredAppt._id),
    }).catch(async () => {
      // If createPaymentOrder checks expiration, create payment directly for test
      const p = await PaymentModel.create({
        bookingId: expiredAppt._id,
        patientId: new Types.ObjectId(testPatientId),
        amount: 750,
        currency: "INR",
        status: "PENDING",
        provider: "MOCK",
        providerOrderId: `order_mock_late_exp_${Date.now()}`,
      });
      return { payment: p, order: { providerOrderId: p.providerOrderId } };
    });
    createdPaymentIds.push(orderData.payment._id);

    // Track refund calls to gateway
    let externalRefundCalls = 0;
    const trackingGateway = new MockPaymentGateway();
    const originalRefund = trackingGateway.refundPayment.bind(trackingGateway);
    trackingGateway.refundPayment = async (params) => {
      externalRefundCalls++;
      // Verify idempotencyKey is supplied
      assert.ok(params.idempotencyKey, "External refund must include idempotency key");
      assert.ok(params.idempotencyKey.length >= 10, "Idempotency key must be >= 10 characters");
      return originalRefund(params);
    };

    paymentService.setGateway(trackingGateway);

    const payId = `pay_late_${Date.now()}`;

    // Two concurrent late payment verification attempts on the expired slot
    const [res1, res2] = await Promise.all([
      paymentService.verifyPayment({
        patientUserId: testPatientId,
        paymentId: String(orderData.payment._id),
        providerOrderId: orderData.order.providerOrderId,
        providerPaymentId: payId,
      }),
      paymentService.verifyPayment({
        patientUserId: testPatientId,
        paymentId: String(orderData.payment._id),
        providerOrderId: orderData.order.providerOrderId,
        providerPaymentId: payId,
      }),
    ]);

    // Restore gateway
    paymentService.setGateway(mockGateway);

    // Exactly 1 external refund call must have been made
    assert.equal(externalRefundCalls, 1, "Only one external refund call must be made despite concurrent requests");

    // Both requests indicate expired and refunded
    assert.equal(res1.expired, true);
    assert.equal(res2.expired, true);

    const finalPayment = await PaymentModel.findById(orderData.payment._id).exec();
    assert.equal(finalPayment?.status, "REFUNDED");
    assert.equal(finalPayment?.refundStatus, "PROCESSED");
    assert.ok(finalPayment?.refundIdempotencyKey);
  });

  it("9. OutboxProcessorWorker: Claims events with lease fencing, delivers notifications and marks PROCESSED", async () => {
    // Clear any prior pending events to test isolated claiming of outboxDoc
    await OutboxEventModel.deleteMany({ status: "PENDING" }).exec();

    const testAggregateId = String(new Types.ObjectId());
    createdEventIds.push(testAggregateId);

    // Create a pending outbox event
    const outboxDoc = await OutboxEventModel.create({
      aggregateType: "APPOINTMENT",
      aggregateId: testAggregateId,
      eventType: "APPOINTMENT_CONFIRMED",
      payload: {
        appointmentId: testAggregateId,
        patientId: testPatientId,
        amount: 750,
      },
      status: "PENDING",
    });

    const outboxWorker = new OutboxProcessorWorker(notifRepo, apptRepo);

    // Process batch
    const stats = await outboxWorker.processBatch(5);
    assert.ok(stats.claimed >= 1, "Must claim at least 1 outbox event");
    assert.ok(stats.processed >= 1, "Must process at least 1 outbox event");

    // Verify document in MongoDB is marked PROCESSED
    const updatedDoc = await OutboxEventModel.findById(outboxDoc._id).exec();
    assert.equal(updatedDoc?.status, "PROCESSED");
    assert.ok(updatedDoc?.processedAt);
    assert.equal(updatedDoc?.lockedUntil, null);

    // Verify in-app notification was generated for patient
    const notifs = await notifRepo.findByRecipient(testPatientId);
    const matchingNotif = notifs.find((n) => String(n.appointment) === testAggregateId);
    assert.ok(matchingNotif, "Patient must receive confirmed appointment notification via outbox");
  });

  it("10. PaymentReconciliationWorker: Cleans abandoned payments and settles pending refunds", async () => {
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);

    // Create an abandoned payment for an already cancelled appointment
    const cancelledAppt = await createTestAppointment("cancelled", -20);
    const abandonedPayment = await PaymentModel.create({
      bookingId: cancelledAppt._id,
      patientId: new Types.ObjectId(testPatientId),
      amount: 500,
      currency: "INR",
      status: "PENDING",
      provider: "MOCK",
      providerOrderId: `order_abandoned_${Date.now()}`,
      createdAt: twentyMinsAgo,
    });
    createdPaymentIds.push(abandonedPayment._id);

    // Create a pending refund older than 15 minutes with refundId
    const pendingRefundPayment = await PaymentModel.create({
      bookingId: cancelledAppt._id,
      patientId: new Types.ObjectId(testPatientId),
      amount: 500,
      currency: "INR",
      status: "REFUND_PENDING",
      refundStatus: "PENDING",
      refundId: `rfnd_pending_${Date.now()}`,
      provider: "MOCK",
      providerOrderId: `order_ref_pending_${Date.now()}`,
      createdAt: twentyMinsAgo,
    });
    createdPaymentIds.push(pendingRefundPayment._id);

    const reconWorker = new PaymentReconciliationWorker(paymentRepo, mockGateway);
    const stats = await reconWorker.reconcileInterruptedPayments();

    assert.ok(stats.pendingAbandoned >= 1, "Must reconcile at least 1 abandoned payment");
    assert.ok(stats.refundsSettled >= 1, "Must settle at least 1 pending refund");

    const checkedAbandoned = await PaymentModel.findById(abandonedPayment._id).exec();
    assert.equal(checkedAbandoned?.status, "FAILED", "Abandoned payment must transition to FAILED");

    const checkedSettled = await PaymentModel.findById(pendingRefundPayment._id).exec();
    assert.equal(checkedSettled?.status, "REFUNDED", "Pending refund must settle to REFUNDED");
    assert.equal(checkedSettled?.refundStatus, "PROCESSED");
  });

  it("11. Crash-Safe Webhook Leases: Stale worker with expired lease cannot overwrite newer results", async () => {
    const eventId = `evt_stale_lease_${Date.now()}`;
    createdEventIds.push(eventId);

    // Simulate an event currently claimed by a worker with an EXPIRED lease
    const staleLeaseToken = "stale-worker-token-111";
    const expiredLockTime = new Date(Date.now() - 5000); // Expired 5 seconds ago

    await WebhookEventModel.create({
      eventId,
      eventType: "payment.captured",
      status: "PROCESSING",
      leaseToken: staleLeaseToken,
      lockedUntil: expiredLockTime,
      attempts: 1,
    });

    // A new worker claims the event and completes it
    const newWorkerResult = await paymentService.handleWebhook({
      eventId,
      payload: {
        event: "payment.captured",
        payload: {
          payment: {
            entity: { id: `pay_stale_${Date.now()}`, order_id: "order_fake" },
          },
        },
      },
    });

    assert.equal(newWorkerResult.received, true);

    const eventDoc = await WebhookEventModel.findOne({ eventId }).exec();
    assert.equal(eventDoc?.status, "PROCESSED");
    const validLeaseToken = eventDoc?.leaseToken;
    assert.notEqual(validLeaseToken, staleLeaseToken, "New worker must have generated a fresh leaseToken");

    // The stale worker wakes up and attempts to commit using its old staleLeaseToken
    const staleCommit = await WebhookEventModel.findOneAndUpdate(
      { eventId, leaseToken: staleLeaseToken },
      { $set: { status: "FAILED", lastError: "Stale worker error" } },
      { new: true },
    ).exec();

    assert.equal(staleCommit, null, "Stale worker fenced out by leaseToken must be prevented from overwriting document");

    // Document in MongoDB must remain PROCESSED
    const finalDoc = await WebhookEventModel.findOne({ eventId }).exec();
    assert.equal(finalDoc?.status, "PROCESSED");
  });
});
