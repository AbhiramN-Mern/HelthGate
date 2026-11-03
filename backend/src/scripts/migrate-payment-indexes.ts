import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import PaymentModel from "../models/payment.model.js";
import WebhookEventModel from "../models/webhookEvent.model.js";
import OutboxEventModel from "../models/outboxEvent.model.js";

async function runPaymentIndexMigration() {
  console.log("=== Phase 3: Payment Index & Constraint Migration ===");
  await connectDB();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Failed to get database handle from Mongoose connection.");
  }

  const paymentsCollection = db.collection("payments");

  // 1. Audit for potential duplicate providerOrderId
  console.log("\n1. Auditing providerOrderId uniqueness...");
  const orderDuplicates = await paymentsCollection
    .aggregate([
      { $match: { providerOrderId: { $exists: true, $ne: null } } },
      { $group: { _id: "$providerOrderId", count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  if (orderDuplicates.length > 0) {
    console.error(`Found ${orderDuplicates.length} duplicate providerOrderId groups!`, orderDuplicates);
    throw new Error("Cannot create unique providerOrderId index: existing duplicates detected.");
  } else {
    console.log("✓ No duplicate providerOrderId records found in payments collection.");
  }

  // 2. Audit for potential duplicate providerPaymentId (excluding null/empty)
  console.log("\n2. Auditing providerPaymentId uniqueness...");
  const paymentDuplicates = await paymentsCollection
    .aggregate([
      {
        $match: {
          providerPaymentId: { $type: "string", $gt: "" },
        },
      },
      { $group: { _id: "$providerPaymentId", count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  if (paymentDuplicates.length > 0) {
    console.error(`Found ${paymentDuplicates.length} duplicate providerPaymentId groups!`, paymentDuplicates);
    throw new Error("Cannot create partial unique providerPaymentId index: existing duplicates detected.");
  } else {
    console.log("✓ No duplicate providerPaymentId records found among active payments.");
  }

  // 3. Inspect existing indexes
  console.log("\n3. Inspecting existing payment collection indexes...");
  const existingIndexes = await paymentsCollection.indexes();
  console.log("Existing indexes:", existingIndexes.map((idx) => `${idx.name}: ${JSON.stringify(idx.key)}`));

  // 4. Safely drop old non-unique indexes if they exist
  for (const idx of existingIndexes) {
    if (idx.name === "providerOrderId_1" && !idx.unique) {
      console.log("Dropping old non-unique providerOrderId_1 index...");
      await paymentsCollection.dropIndex("providerOrderId_1");
      console.log("✓ Dropped providerOrderId_1 index.");
    }
    if (idx.name === "providerPaymentId_1" && !idx.unique) {
      console.log("Dropping old non-unique providerPaymentId_1 index...");
      await paymentsCollection.dropIndex("providerPaymentId_1");
      console.log("✓ Dropped providerPaymentId_1 index.");
    }
  }

  // 5. Create new constraints via Mongoose syncIndexes
  console.log("\n4. Syncing indexes for Payment, WebhookEvent, and OutboxEvent models...");
  await PaymentModel.syncIndexes();
  await WebhookEventModel.syncIndexes();
  await OutboxEventModel.syncIndexes();
  console.log("✓ Model indexes synced successfully.");

  // 6. Verify newly created indexes
  const updatedIndexes = await paymentsCollection.indexes();
  console.log("\n5. Verification of payments collection indexes:");
  for (const idx of updatedIndexes) {
    console.log(
      `- ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${Boolean(idx.unique)}, partialFilter: ${
        idx.partialFilterExpression ? JSON.stringify(idx.partialFilterExpression) : "none"
      })`,
    );
  }

  console.log("\n=== Migration completed successfully! ===");
  await mongoose.disconnect();
}

runPaymentIndexMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
