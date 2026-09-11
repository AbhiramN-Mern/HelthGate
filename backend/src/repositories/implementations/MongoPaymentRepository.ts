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

  async create(paymentData: Partial<Payment> & Record<string, unknown>): Promise<any> {
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

  async findByIdAndUpdate(id: string | Types.ObjectId, update: Record<string, unknown>): Promise<any | null> {
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

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return PaymentModel.countDocuments(filter).exec();
  }
}
