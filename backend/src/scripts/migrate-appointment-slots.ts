import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import {
  normalizeAppointmentDate,
  normalizeTimeSlot,
  toMidnightUTCDate,
} from "../utils/slotNormalizer.js";

dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });
if (!process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

export async function runAppointmentSlotMigration() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGO_URI not defined in environment");
  }

  console.log("[Migration] Connecting to MongoDB...");
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { dbName: "healthgate" });
  }

  const apptColl = mongoose.connection.db!.collection("appointments");
  const totalCount = await apptColl.countDocuments();
  console.log(`[Migration] Total appointments found: ${totalCount}`);

  // Step 1: Fetch all appointments
  const allAppointments = await apptColl.find({}).toArray();

  const activeStatuses = [
    "pending_payment",
    "PENDING_PAYMENT",
    "scheduled",
    "confirmed",
    "CONFIRMED",
  ];

  // Step 2: Check for existing duplicate active appointments
  console.log("[Migration] Auditing active appointments for duplicate slots...");
  const slotBuckets = new Map<string, any[]>();

  for (const appt of allAppointments) {
    if (activeStatuses.includes(String(appt.status))) {
      const nDate = normalizeAppointmentDate(appt.appointmentDate);
      const nSlot = normalizeTimeSlot(appt.timeSlot);
      const key = `${String(appt.doctor)}_${nDate}_${nSlot}`;

      if (!slotBuckets.has(key)) {
        slotBuckets.set(key, []);
      }
      slotBuckets.get(key)!.push(appt);
    }
  }

  let conflictsResolved = 0;
  for (const [key, group] of slotBuckets.entries()) {
    if (group.length > 1) {
      console.warn(`[Migration] Slot conflict detected for key ${key}: ${group.length} active appointments.`);

      // Sort: keep confirmed over pending_payment, then oldest createdAt
      group.sort((a, b) => {
        const scoreA = (a.status === "confirmed" || a.status === "CONFIRMED") ? 2 : 1;
        const scoreB = (b.status === "confirmed" || b.status === "CONFIRMED") ? 2 : 1;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });

      const winner = group[0];
      const duplicates = group.slice(1);

      console.log(`[Migration] Retaining primary appointment ID: ${winner._id} (status: ${winner.status})`);

      for (const duplicate of duplicates) {
        console.warn(`[Migration] Safely cancelling conflicting duplicate ID: ${duplicate._id} (status: ${duplicate.status}) without deletion.`);
        await apptColl.updateOne(
          { _id: duplicate._id },
          {
            $set: {
              status: "cancelled",
              cancelledBy: "system",
              cancelledAt: new Date(),
              cancellationReason: "Resolved duplicate booking conflict during system data migration",
            },
            $push: {
              actionHistory: {
                action: "duplicate_conflict_cancelled_by_migration",
                initiatedByRole: "system",
                approvalStatus: "not_required",
                timestamp: new Date(),
                details: {
                  reason: "Slot conflict resolved safely during system data migration",
                  conflictingSlot: key,
                  retainedAppointmentId: winner._id,
                },
              } as any,
            },
          },
        );
        conflictsResolved++;
      }
    }
  }

  console.log(`[Migration] Active slot conflicts resolved: ${conflictsResolved}`);

  // Step 3: Populate normalizedDate, normalizedTimeSlot, and bookingExpiresAt on all appointments
  console.log("[Migration] Populating normalizedDate, normalizedTimeSlot, UTC midnight appointmentDate, and bookingExpiresAt...");
  let updatedCount = 0;

  for (const appt of allAppointments) {
    try {
      const nDate = normalizeAppointmentDate(appt.appointmentDate);
      const nSlot = normalizeTimeSlot(appt.timeSlot);
      const midnightDate = toMidnightUTCDate(appt.appointmentDate);

      const updateFields: Record<string, any> = {
        normalizedDate: nDate,
        normalizedTimeSlot: nSlot,
        appointmentDate: midnightDate,
      };

      // Set bookingExpiresAt for legacy pending appointments if missing
      if (
        String(appt.status).toLowerCase().includes("pending") &&
        !appt.bookingExpiresAt
      ) {
        const createdTime = appt.createdAt ? new Date(appt.createdAt).getTime() : Date.now();
        updateFields.bookingExpiresAt = new Date(createdTime + 10 * 60 * 1000);
      }

      await apptColl.updateOne(
        { _id: appt._id },
        {
          $set: updateFields,
        },
      );
      updatedCount++;
    } catch (normErr: any) {
      console.error(`[Migration] Failed to normalize appointment ID ${appt._id}:`, normErr.message);
    }
  }

  console.log(`[Migration] Successfully populated normalized fields for ${updatedCount} / ${totalCount} records.`);

  // Step 4: Create MongoDB partial unique compound index
  console.log("[Migration] Creating partial unique compound index 'unique_active_doctor_slot'...");
  const indexName = "unique_active_doctor_slot";

  // Check if index already exists
  const existingIndexes = await apptColl.indexes();
  const alreadyIndexed = existingIndexes.some((idx) => idx.name === indexName);

  if (!alreadyIndexed) {
    const createdIndexName = await apptColl.createIndex(
      { doctor: 1, normalizedDate: 1, normalizedTimeSlot: 1 },
      {
        unique: true,
        partialFilterExpression: {
          status: {
            $in: activeStatuses,
          },
        },
        name: indexName,
      },
    );
    console.log(`[Migration] Partial unique index created successfully: ${createdIndexName}`);
  } else {
    console.log(`[Migration] Partial unique index '${indexName}' already exists.`);
  }

  console.log("[Migration] Migration completed successfully!");
}

// Execute directly if run as a script
if (process.argv[1] && process.argv[1].includes("migrate-appointment-slots")) {
  runAppointmentSlotMigration()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("[Migration] Migration failed with error:", err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

