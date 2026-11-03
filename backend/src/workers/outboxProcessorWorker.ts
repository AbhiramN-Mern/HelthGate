import crypto from "crypto";
import { Types } from "mongoose";
import OutboxEventModel, { type OutboxEvent } from "../models/outboxEvent.model.js";
import type { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import type { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import type { NotificationService } from "../services/notification.service.js";

export interface OutboxProcessingStats {
  claimed: number;
  processed: number;
  failed: number;
  staleRecovered: number;
}

export class OutboxProcessorWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private notificationRepo?: INotificationRepository,
    private appointmentRepo?: IAppointmentRepository,
    private notificationService?: NotificationService,
  ) {}

  /**
   * Atomically claims the next ready outbox event using lease fencing.
   * Stale leases (lockedUntil <= now) are eligible for reclamation.
   */
  async claimNextEvent(leaseDurationMs = 30000): Promise<{
    event: (OutboxEvent & { _id: any }) | null;
    leaseToken: string;
  }> {
    const now = new Date();
    const leaseToken = crypto.randomUUID();
    const lockedUntil = new Date(Date.now() + leaseDurationMs);

    const doc = await OutboxEventModel.findOneAndUpdate(
      {
        $or: [
          {
            status: "PENDING",
            nextRetryAt: { $lte: now },
          },
          {
            status: "PROCESSING",
            lockedUntil: { $lte: now },
          },
        ],
      },
      {
        $set: {
          status: "PROCESSING",
          leaseToken,
          lockedUntil,
        },
      },
      { new: true, sort: { createdAt: 1 } },
    ).exec();

    return {
      event: (doc as any) || null,
      leaseToken,
    };
  }

  /**
   * Dispatches a single claimed event to destination notification channels.
   */
  private async dispatchEvent(event: OutboxEvent & { _id: any }): Promise<void> {
    const { eventType, payload } = event;

    switch (eventType) {
      case "APPOINTMENT_CONFIRMED": {
        const appointmentId = payload.appointmentId || event.aggregateId;
        if (this.notificationService && this.appointmentRepo) {
          const appt = await this.appointmentRepo.findById(appointmentId, true);
          if (appt) {
            await this.notificationService.sendAppointmentConfirmation(appt);
            break;
          }
        }

        // Fallback: direct in-app notification to patient if repo available
        if (this.notificationRepo && payload.patientId) {
          await this.notificationRepo.create({
            recipient: payload.patientId,
            type: "general",
            title: "Appointment Confirmed",
            message: `Your appointment ${appointmentId} has been confirmed. Payment was successful.`,
            appointment: Types.ObjectId.isValid(appointmentId)
              ? new Types.ObjectId(appointmentId)
              : undefined,
          });
        }
        break;
      }

      case "PAYMENT_REFUNDED": {
        if (this.notificationRepo && payload.patientId) {
          const amount = payload.amount || 0;
          const currency = payload.currency || "INR";
          const apptId = payload.bookingId || event.aggregateId;
          await this.notificationRepo.create({
            recipient: payload.patientId,
            type: "general",
            title: "Payment Refund Processed",
            message: `A refund of ${currency} ${amount} has been processed for booking ${payload.bookingId || event.aggregateId}.`,
            appointment: Types.ObjectId.isValid(apptId) ? new Types.ObjectId(apptId) : undefined,
          });
        }
        break;
      }

      case "APPOINTMENT_CANCELLED": {
        const appointmentId = payload.appointmentId || event.aggregateId;
        if (this.notificationService && this.appointmentRepo) {
          const appt = await this.appointmentRepo.findById(appointmentId, true);
          if (appt) {
            await this.notificationService.sendAppointmentCancellation(
              appt,
              "pending_payment",
              payload.reason || "Booking reservation cancelled",
            );
            break;
          }
        }

        if (this.notificationRepo && payload.patientId) {
          await this.notificationRepo.create({
            recipient: payload.patientId,
            type: "cancellation",
            title: "Appointment Cancelled",
            message: `Your appointment reservation ${appointmentId} was cancelled: ${payload.reason || "Time limit expired"}`,
            appointment: appointmentId,
          });
        }
        break;
      }

      default:
        console.warn(`[OutboxProcessor] Unhandled event type: ${eventType}`);
        break;
    }
  }

  /**
   * Processes a batch of ready events with lease fencing and exponential backoff on failure.
   */
  async processBatch(batchSize = 10, leaseDurationMs = 30000): Promise<OutboxProcessingStats> {
    const stats: OutboxProcessingStats = {
      claimed: 0,
      processed: 0,
      failed: 0,
      staleRecovered: 0,
    };

    for (let i = 0; i < batchSize; i++) {
      const { event, leaseToken } = await this.claimNextEvent(leaseDurationMs);
      if (!event) {
        break; // No more eligible events
      }

      stats.claimed++;
      const eventId = (event as any)._id;

      try {
        await this.dispatchEvent(event);

        // Fenced update: only commit PROCESSED if lease is still ours
        const result = await OutboxEventModel.findOneAndUpdate(
          {
            _id: eventId,
            leaseToken,
          },
          {
            $set: {
              status: "PROCESSED",
              processedAt: new Date(),
              lockedUntil: null,
            },
          },
          { new: true },
        ).exec();

        if (result) {
          stats.processed++;
        } else {
          console.warn(
            `[OutboxProcessor] Lease expired or stolen for event ${eventId}. Did not mark PROCESSED.`,
          );
        }
      } catch (err: any) {
        stats.failed++;
        const currentRetries = (event.retryCount || 0) + 1;
        const maxRetries = event.maxRetries || 5;
        const isExhausted = currentRetries >= maxRetries;
        const backoffMs = Math.min(1000 * Math.pow(2, currentRetries), 60000);
        const nextRetryAt = new Date(Date.now() + backoffMs);

        await OutboxEventModel.findOneAndUpdate(
          {
            _id: eventId,
            leaseToken,
          },
          {
            $set: {
              status: isExhausted ? "FAILED" : "PENDING",
              retryCount: currentRetries,
              nextRetryAt,
              lastError: err?.message || String(err),
              lockedUntil: null,
            },
          },
        ).exec();

        console.error(
          `[OutboxProcessor] Error processing event ${eventId} (attempt ${currentRetries}/${maxRetries}):`,
          err,
        );
      }
    }

    return stats;
  }

  /**
   * Starts periodic execution of the outbox processor.
   */
  start(intervalMs = 5000): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log(`[OutboxProcessor] Outbox worker started (Interval: ${intervalMs}ms)`);

    this.timer = setInterval(async () => {
      try {
        const stats = await this.processBatch();
        if (stats.processed > 0) {
          console.log(`[OutboxProcessor] Processed ${stats.processed} outbox event(s).`);
        }
      } catch (err) {
        console.error("[OutboxProcessor] Unhandled error during sweep:", err);
      }
    }, intervalMs);

    if (this.timer?.unref) {
      this.timer.unref();
    }
  }

  /**
   * Gracefully stops the outbox processor.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[OutboxProcessor] Outbox worker stopped.");
  }
}
