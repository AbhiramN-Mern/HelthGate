import { Types } from "mongoose";
import PaymentModel, { Payment } from "../../models/payment.model.js";
import { IPaymentRepository } from "../interfaces/IPaymentRepository.js";

export class MongoPaymentRepository implements IPaymentRepository {
  private applyStandardPopulate(query: any) {
    return query
      .populate({
        path: "bookingId",
        populate: [
          {
            path: "doctor",
            populate: [
              { path: "user", select: "name email role" },
              { path: "hospital", select: "name isActive" },
            ],
          },
          { path: "hospital", select: "name address contactInfo" },
          { path: "patient", select: "name email" },
        ],
      })
      .populate("patientId", "name email role");
  }

  async create(
    paymentData: Partial<Payment> & Record<string, unknown>,
    options?: { session?: any },
  ): Promise<any> {
    if (options?.session) {
      const doc = new PaymentModel(paymentData);
      return doc.save({ session: options.session });
    }
    return PaymentModel.create(paymentData);
  }

  async findById(id: string | Types.ObjectId, populateDetails = true): Promise<any | null> {
    let query = PaymentModel.findById(id);
    if (populateDetails) {
      query = this.applyStandardPopulate(query);
    }
    return query.exec();
  }

  async findOne(filter: Record<string, unknown>, populateDetails = true): Promise<any | null> {
    let query = PaymentModel.findOne(filter);
    if (populateDetails) {
      query = this.applyStandardPopulate(query);
    }
    return query.exec();
  }

  async findByBookingId(bookingId: string | Types.ObjectId, populateDetails = true): Promise<any[]> {
    let query = PaymentModel.find({ bookingId }).sort({ createdAt: -1 });
    if (populateDetails) {
      query = this.applyStandardPopulate(query);
    }
    return query.exec();
  }

  async find(
    filter: Record<string, unknown>,
    populateDetails = false,
    sort: Record<string, 1 | -1> = { createdAt: -1 },
    limit?: number,
    skip?: number,
  ): Promise<any[]> {
    let query = PaymentModel.find(filter).sort(sort);
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

  async findByIdAndUpdate(
    id: string | Types.ObjectId,
    update: Record<string, unknown>,
  ): Promise<any | null> {
    return PaymentModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async updateStatus(
    id: string | Types.ObjectId,
    status: string,
    extra: Record<string, unknown> = {},
  ): Promise<any | null> {
    return PaymentModel.findByIdAndUpdate(
      id,
      { status, ...extra },
      { new: true },
    ).exec();
  }

  async transitionToSuccess(
    paymentId: string | Types.ObjectId,
    providerPaymentId: string,
    session?: any,
  ): Promise<any | null> {
    const opts: any = { new: true };
    if (session) opts.session = session;

    return PaymentModel.findOneAndUpdate(
      { _id: paymentId, status: "PENDING" },
      {
        $set: {
          status: "SUCCESS",
          providerPaymentId,
        },
      },
      opts,
    ).exec();
  }

  async transitionToFailed(
    paymentId: string | Types.ObjectId,
    failureReason: string,
    session?: any,
  ): Promise<any | null> {
    const opts: any = { new: true };
    if (session) opts.session = session;

    return PaymentModel.findOneAndUpdate(
      { _id: paymentId, status: "PENDING" },
      {
        $set: {
          status: "FAILED",
          failureReason,
        },
      },
      opts,
    ).exec();
  }

  async acquireRefundLock(
    paymentId: string | Types.ObjectId,
    idempotencyKey: string,
    refundPayload: any,
  ): Promise<any | null> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return PaymentModel.findOneAndUpdate(
      {
        _id: paymentId,
        $or: [
          {
            refundStatus: { $in: ["NONE", "FAILED"] },
            status: { $in: ["SUCCESS", "PENDING", "REFUND_FAILED"] },
          },
          {
            refundStatus: "REQUESTED",
            updatedAt: { $lte: fiveMinutesAgo },
          },
        ],
      },
      {
        $set: {
          status: "REFUND_REQUESTED",
          refundStatus: "REQUESTED",
          refundIdempotencyKey: idempotencyKey,
          refundPayload,
        },
      },
      { new: true },
    ).exec();
  }

  async transitionToRefundPending(
    paymentId: string | Types.ObjectId,
    refundId: string,
    session?: any,
  ): Promise<any | null> {
    const opts: any = { new: true };
    if (session) opts.session = session;

    return PaymentModel.findOneAndUpdate(
      { _id: paymentId, refundStatus: "REQUESTED" },
      {
        $set: {
          status: "REFUND_PENDING",
          refundStatus: "PENDING",
          refundId,
        },
      },
      opts,
    ).exec();
  }

  async transitionToRefunded(
    paymentId: string | Types.ObjectId,
    refundId: string,
    refundedAt: Date = new Date(),
    session?: any,
  ): Promise<any | null> {
    const opts: any = { new: true };
    if (session) opts.session = session;

    return PaymentModel.findOneAndUpdate(
      {
        _id: paymentId,
        refundStatus: { $in: ["REQUESTED", "PENDING", "NONE", "FAILED"] },
        status: { $ne: "REFUNDED" },
      },
      {
        $set: {
          status: "REFUNDED",
          refundStatus: "PROCESSED",
          refundId,
          refundedAt,
        },
      },
      opts,
    ).exec();
  }

  async transitionToRefundFailed(
    paymentId: string | Types.ObjectId,
    failureReason: string,
    session?: any,
  ): Promise<any | null> {
    const opts: any = { new: true };
    if (session) opts.session = session;

    return PaymentModel.findOneAndUpdate(
      { _id: paymentId, refundStatus: { $in: ["REQUESTED", "PENDING"] } },
      {
        $set: {
          status: "REFUND_FAILED",
          refundStatus: "FAILED",
          failureReason,
        },
      },
      opts,
    ).exec();
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return PaymentModel.countDocuments(filter).exec();
  }
}
