import type { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import type { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";

export interface CleanupResult {
  checked: number;
  expiredCancelled: number;
  errors: number;
}

export class ReservationCleanupWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private appointmentRepo: IAppointmentRepository,
    private notificationRepo?: INotificationRepository,
  ) {}

  /**
   * Sweeps the database for appointments that are still pending_payment
   * and whose reservation timeout (bookingExpiresAt) has elapsed.
   * Atomically transitions them to cancelled.
   */
  async cleanupExpiredReservations(referenceDate?: Date): Promise<CleanupResult> {
    const now = referenceDate || new Date();
    const result: CleanupResult = {
      checked: 0,
      expiredCancelled: 0,
      errors: 0,
    };

    try {
      const expiredAppointments = await this.appointmentRepo.findExpiredReservations(now);
      result.checked = expiredAppointments.length;

      for (const appt of expiredAppointments) {
        try {
          const cancelled = await this.appointmentRepo.cancelExpiredReservation(appt._id, now);
          if (cancelled) {
            result.expiredCancelled++;

            // Notify patient that reservation expired and slot was released
            if (this.notificationRepo) {
              const patientId = (appt.patient as any)?._id || appt.patient;
              if (patientId) {
                const dateStr = appt.appointmentDate
                  ? new Date(appt.appointmentDate).toLocaleDateString()
                  : "";
                await this.notificationRepo.create({
                  recipient: patientId,
                  type: "cancellation",
                  title: "Booking Reservation Expired",
                  message: `Your booking reservation for ${dateStr} at ${appt.timeSlot} expired because payment was not completed within the allowed time limit. The slot has been released.`,
                  appointment: appt._id,
                });
              }
            }
          }
        } catch (itemErr) {
          result.errors++;
          console.error(`[CleanupWorker] Failed to cancel expired appointment ${appt._id}:`, itemErr);
        }
      }
    } catch (err) {
      console.error("[CleanupWorker] Error querying expired reservations:", err);
      result.errors++;
    }

    return result;
  }

  /**
   * Starts periodic execution of the cleanup worker.
   */
  start(intervalMs?: number): void {
    if (this.isRunning) return;

    const interval =
      intervalMs ||
      Number(process.env.RESERVATION_CLEANUP_INTERVAL_MS) ||
      60000; // default: 1 minute

    this.isRunning = true;
    console.log(`[CleanupWorker] Reservation cleanup worker started (Interval: ${interval / 1000}s)`);

    this.timer = setInterval(async () => {
      try {
        const stats = await this.cleanupExpiredReservations();
        if (stats.expiredCancelled > 0) {
          console.log(
            `[CleanupWorker] Released ${stats.expiredCancelled} expired pending reservation(s).`,
          );
        }
      } catch (err) {
        console.error("[CleanupWorker] Unhandled error during periodic sweep:", err);
      }
    }, interval);

    // Unref timer so it does not block the Node.js event loop from exiting
    if (this.timer?.unref) {
      this.timer.unref();
    }
  }

  /**
   * Gracefully stops the cleanup worker.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[CleanupWorker] Reservation cleanup worker stopped.");
  }
}

