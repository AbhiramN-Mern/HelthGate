import { Types } from "mongoose";
import AppointmentModel, { Appointment } from "../../models/appointment.model.js";
import { IAppointmentRepository } from "../interfaces/IAppointmentRepository.js";
import {
  normalizeAppointmentDate,
  normalizeTimeSlot,
  toMidnightUTCDate,
} from "../../utils/slotNormalizer.js";

export class MongoAppointmentRepository implements IAppointmentRepository {
  private applyStandardPopulate(query: any) {
    return query
      .populate({
        path: "doctor",
        populate: [
          { path: "user", select: "name email role" },
          { path: "hospital", select: "name isActive" },
        ],
      })
      .populate("hospital", "name isActive licenseNumber address contactInfo departments")
      .populate("hospitalDoctor")
      .populate("patient", "name email");
  }

  async create(
    appointmentData: Partial<Appointment> & Record<string, unknown>,
    session?: any,
  ): Promise<any> {
    const data = { ...appointmentData };
    if (data.appointmentDate && !data.normalizedDate) {
      data.normalizedDate = normalizeAppointmentDate(data.appointmentDate as any);
      data.appointmentDate = toMidnightUTCDate(data.appointmentDate as any);
    }
    if (data.timeSlot && !data.normalizedTimeSlot) {
      data.normalizedTimeSlot = normalizeTimeSlot(data.timeSlot as string);
      data.timeSlot = data.normalizedTimeSlot;
    }
    if (data.paymentExpiresAt && !data.bookingExpiresAt) {
      data.bookingExpiresAt = data.paymentExpiresAt;
    } else if (data.bookingExpiresAt && !data.paymentExpiresAt) {
      data.paymentExpiresAt = data.bookingExpiresAt;
    }
    if (session) {
      const created = await AppointmentModel.create([data], { session });
      return created[0];
    }
    return AppointmentModel.create(data);
  }

  async findById(id: string | Types.ObjectId, populateDetails = true): Promise<any | null> {
    let query = AppointmentModel.findById(id);
    if (populateDetails) {
      query = this.applyStandardPopulate(query);
    }
    return query.exec();
  }

  async findOne(filter: Record<string, unknown>, populateDetails = true): Promise<any | null> {
    let query = AppointmentModel.findOne(filter);
    if (populateDetails) {
      query = this.applyStandardPopulate(query);
    }
    return query.exec();
  }

  async find(
    filter: Record<string, unknown>,
    populateDetails = false,
    sort: Record<string, 1 | -1> = { appointmentDate: 1 },
    select?: string,
    limit?: number,
    skip?: number,
  ): Promise<any[]> {
    let query = AppointmentModel.find(filter).sort(sort);
    if (select) {
      query = query.select(select) as any;
    }
    if (skip !== undefined && skip > 0) {
      query = query.skip(skip);
    }
    if (limit !== undefined && limit > 0) {
      query = query.limit(limit);
    }
    if (populateDetails) {
      query = this.applyStandardPopulate(query);
    }
    return query.exec();
  }

  async findByIdAndUpdate(id: string | Types.ObjectId, update: Record<string, unknown>): Promise<any | null> {
    return AppointmentModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async updateStatus(id: string | Types.ObjectId, status: string): Promise<any | null> {
    return AppointmentModel.findByIdAndUpdate(id, { $set: { status } }, { new: true }).exec();
  }

  async updateRescheduleRequest(
    id: string | Types.ObjectId,
    rescheduleRequest: Record<string, unknown>,
  ): Promise<any | null> {
    return AppointmentModel.findByIdAndUpdate(
      id,
      { $set: { rescheduleRequest } },
      { new: true },
    ).exec();
  }

  async applyReschedule(
    id: string | Types.ObjectId,
    appointmentDate: Date,
    timeSlot: string,
    rescheduleRequest: Record<string, unknown>,
    actionHistoryItem?: Record<string, unknown>,
  ): Promise<any | null> {
    const normalizedDate = normalizeAppointmentDate(appointmentDate);
    const normalizedSlot = normalizeTimeSlot(timeSlot);
    const midnightDate = toMidnightUTCDate(appointmentDate);

    const updateObj: Record<string, unknown> = {
      $set: {
        appointmentDate: midnightDate,
        timeSlot: normalizedSlot,
        normalizedDate,
        normalizedTimeSlot: normalizedSlot,
        status: "confirmed",
        rescheduleRequest,
      },
    };
    if (actionHistoryItem) {
      updateObj.$push = { actionHistory: actionHistoryItem };
    }
    return AppointmentModel.findByIdAndUpdate(id, updateObj, { new: true }).exec();
  }

  async cancelWithAudit(
    id: string | Types.ObjectId,
    data: {
      cancelledBy: string;
      cancelledByUser?: string | Types.ObjectId | null;
      cancelledAt: Date;
      cancellationReason?: string | null;
      actionHistoryItem?: Record<string, unknown>;
    },
  ): Promise<any | null> {
    const updateObj: Record<string, unknown> = {
      $set: {
        status: "cancelled",
        cancelledBy: data.cancelledBy,
        cancelledByUser: data.cancelledByUser || null,
        cancelledAt: data.cancelledAt,
        cancellationReason: data.cancellationReason || null,
      },
    };
    if (data.actionHistoryItem) {
      updateObj.$push = { actionHistory: data.actionHistoryItem };
    }
    return AppointmentModel.findByIdAndUpdate(id, updateObj, { new: true }).exec();
  }

  async adminReschedule(
    id: string | Types.ObjectId,
    appointmentDate: Date,
    timeSlot: string,
    rescheduleRequest: Record<string, unknown>,
    actionHistoryItem?: Record<string, unknown>,
  ): Promise<any | null> {
    const normalizedDate = normalizeAppointmentDate(appointmentDate);
    const normalizedSlot = normalizeTimeSlot(timeSlot);
    const midnightDate = toMidnightUTCDate(appointmentDate);

    const updateObj: Record<string, unknown> = {
      $set: {
        appointmentDate: midnightDate,
        timeSlot: normalizedSlot,
        normalizedDate,
        normalizedTimeSlot: normalizedSlot,
        status: "confirmed",
        rescheduleRequest,
      },
    };
    if (actionHistoryItem) {
      updateObj.$push = { actionHistory: actionHistoryItem };
    }
    return AppointmentModel.findByIdAndUpdate(id, updateObj, { new: true }).exec();
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return AppointmentModel.countDocuments(filter).exec();
  }

  async findExpiredReservations(now: Date = new Date()): Promise<any[]> {
    return AppointmentModel.find({
      status: { $in: ["pending_payment", "PENDING_PAYMENT"] },
      $or: [
        { paymentExpiresAt: { $lte: now } },
        { bookingExpiresAt: { $lte: now } },
      ],
    }).exec();
  }

  async cancelExpiredReservation(
    id: string | Types.ObjectId,
    now: Date = new Date(),
  ): Promise<any | null> {
    const updateObj: Record<string, unknown> = {
      $set: {
        status: "EXPIRED",
        cancelledBy: "system",
        cancelledAt: now,
        cancellationReason:
          "Reservation expired: payment was not completed within the allowed time limit",
      },
      $push: {
        actionHistory: {
          action: "cancelled_due_to_payment_timeout",
          initiatedByRole: "system",
          approvalStatus: "not_required",
          timestamp: now,
          details: {
            reason: "Reservation expired: payment was not completed within the allowed time limit",
          },
        },
      },
    };

    return AppointmentModel.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ["pending_payment", "PENDING_PAYMENT"] },
        $or: [
          { paymentExpiresAt: { $lte: now } },
          { bookingExpiresAt: { $lte: now } },
        ],
      },
      updateObj,
      { new: true },
    ).exec();
  }

  async cancelExpiredReservationsForSlot(
    doctor: string | Types.ObjectId,
    normalizedDate: string,
    normalizedTimeSlot: string,
    now: Date = new Date(),
  ): Promise<number> {
    const result = await AppointmentModel.updateMany(
      {
        doctor,
        normalizedDate,
        normalizedTimeSlot,
        status: { $in: ["pending_payment", "PENDING_PAYMENT"] },
        $or: [
          { paymentExpiresAt: { $lte: now } },
          { bookingExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          status: "EXPIRED",
          cancelledBy: "system",
          cancelledAt: now,
          cancellationReason:
            "Reservation expired: payment was not completed within the allowed time limit",
        },
        $push: {
          actionHistory: {
            action: "cancelled_due_to_payment_timeout",
            initiatedByRole: "system",
            approvalStatus: "not_required",
            timestamp: now,
            details: {
              reason: "Reservation expired before new booking attempt",
            },
          },
        },
      },
    ).exec();

    return result.modifiedCount || 0;
  }

  async atomicConfirmPayment(
    id: string | Types.ObjectId,
    now: Date = new Date(),
    session?: any,
  ): Promise<any | null> {
    const updateObj: Record<string, unknown> = {
      $set: {
        status: "confirmed",
      },
      $push: {
        actionHistory: {
          action: "payment_confirmed",
          initiatedByRole: "patient",
          approvalStatus: "approved",
          timestamp: now,
          details: {
            reason: "Payment verified successfully",
          },
        },
      },
    };

    const options: any = { new: true };
    if (session) {
      options.session = session;
    }

    return AppointmentModel.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ["pending_payment", "PENDING_PAYMENT"] },
        $and: [
          {
            $or: [
              { paymentExpiresAt: null },
              { paymentExpiresAt: { $gt: now } },
            ],
          },
          {
            $or: [
              { bookingExpiresAt: null },
              { bookingExpiresAt: { $gt: now } },
            ],
          },
        ],
      },
      updateObj,
      options,
    ).exec();
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    return AppointmentModel.aggregate(pipeline).exec();
  }
}

