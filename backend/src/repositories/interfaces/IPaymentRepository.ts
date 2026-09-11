import { Types } from "mongoose";
import { Payment } from "../../models/payment.model.js";

export interface IPaymentRepository {
  create(paymentData: Partial<Payment> & Record<string, unknown>): Promise<any>;
  findById(id: string | Types.ObjectId, populateDetails?: boolean): Promise<any | null>;
  findOne(filter: Record<string, unknown>, populateDetails?: boolean): Promise<any | null>;
  findByBookingId(bookingId: string | Types.ObjectId, populateDetails?: boolean): Promise<any[]>;
  find(
    filter: Record<string, unknown>,
    populateDetails?: boolean,
    sort?: Record<string, 1 | -1>,
    limit?: number,
    skip?: number,
  ): Promise<any[]>;
  findByIdAndUpdate(id: string | Types.ObjectId, update: Record<string, unknown>): Promise<any | null>;
  updateStatus(
    id: string | Types.ObjectId,
    status: string,
    extra?: Record<string, unknown>,
  ): Promise<any | null>;
  count(filter?: Record<string, unknown>): Promise<number>;
}
