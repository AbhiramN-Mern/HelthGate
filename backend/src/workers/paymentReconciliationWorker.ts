import PaymentModel from "../models/payment.model.js";
import AppointmentModel from "../models/appointment.model.js";
import type { IPaymentRepository } from "../repositories/interfaces/IPaymentRepository.js";
import type { IPaymentGateway } from "../infrastructure/payment/IPaymentGateway.js";

export interface ReconciliationStats {
  pendingAbandoned: number;
  refundsChecked: number;
  refundsSettled: number;
  errors: number;
}

export class PaymentReconciliationWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private paymentRepo: IPaymentRepository,
    private paymentGateway?: IPaymentGateway,
  ) {}

  /**
   * Sweeps orphaned/interrupted payments:
   * 1. PENDING payments whose reservation window expired (>15 mins old) and whose appointment is cancelled.
   * 2. REFUND_REQUESTED or REFUND_PENDING payments that need reconciliation.
   */
  async reconcileInterruptedPayments(referenceDate?: Date): Promise<ReconciliationStats> {
    const now = referenceDate || new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const stats: ReconciliationStats = {
      pendingAbandoned: 0,
      refundsChecked: 0,
      refundsSettled: 0,
      errors: 0,
    };

    try {
      // 1. Reconcile abandoned PENDING payments
      const abandonedPayments = await PaymentModel.find({
        status: "PENDING",
        createdAt: { $lte: fifteenMinutesAgo },
      }).exec();

      for (const p of abandonedPayments) {
        try {
          const appt = await AppointmentModel.findById(p.bookingId).exec();
          if (
            appt &&
            (appt.status === "cancelled" ||
              appt.status === "expired" ||
              appt.status === "EXPIRED")
          ) {
            const updated = await this.paymentRepo.transitionToFailed(
              p._id,
              "Payment abandoned: booking reservation expired before completion",
            );
            if (updated) {
              stats.pendingAbandoned++;
            }
          }
        } catch (itemErr) {
          stats.errors++;
          console.error(
            `[PaymentReconciliation] Error reconciling abandoned payment ${p._id}:`,
            itemErr,
          );
        }
      }

      // 2. Reconcile pending refunds
      const pendingRefunds = await PaymentModel.find({
        status: { $in: ["REFUND_REQUESTED", "REFUND_PENDING"] },
        createdAt: { $lte: fifteenMinutesAgo },
      }).exec();

      stats.refundsChecked = pendingRefunds.length;

      for (const p of pendingRefunds) {
        try {
          // If refundId is already assigned, check if we can mark REFUNDED
          if (p.refundId) {
            const updated = await this.paymentRepo.transitionToRefunded(
              p._id,
              p.refundId,
              new Date(),
            );
            if (updated) {
              stats.refundsSettled++;
            }
          }
        } catch (itemErr) {
          stats.errors++;
          console.error(
            `[PaymentReconciliation] Error reconciling pending refund ${p._id}:`,
            itemErr,
          );
        }
      }
    } catch (err) {
      console.error("[PaymentReconciliation] Unhandled error during reconciliation sweep:", err);
      stats.errors++;
    }

    return stats;
  }

  /**
   * Starts periodic execution of the reconciliation worker.
   */
  start(intervalMs = 300000): void {
    // Default 5 minutes
    if (this.isRunning) return;

    this.isRunning = true;
    console.log(`[PaymentReconciliation] Worker started (Interval: ${intervalMs / 1000}s)`);

    this.timer = setInterval(async () => {
      try {
        const stats = await this.reconcileInterruptedPayments();
        if (stats.pendingAbandoned > 0 || stats.refundsSettled > 0) {
          console.log(
            `[PaymentReconciliation] Reconciled: ${stats.pendingAbandoned} abandoned, ${stats.refundsSettled} refunded.`,
          );
        }
      } catch (err) {
        console.error("[PaymentReconciliation] Unhandled error during sweep:", err);
      }
    }, intervalMs);

    if (this.timer?.unref) {
      this.timer.unref();
    }
  }

  /**
   * Gracefully stops the reconciliation worker.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[PaymentReconciliation] Worker stopped.");
  }
}

