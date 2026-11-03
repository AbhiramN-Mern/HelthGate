import mongoose, { type ClientSession } from "mongoose";
import type { ITransactionManager } from "../../core/transactions/ITransactionManager.js";
import { TransactionNotSupportedError } from "../../core/errors/AppError.js";

export class MongooseTransactionManager implements ITransactionManager {
  async executeTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    if (mongoose.connection.readyState !== 1) {
      if (process.env.NODE_ENV === "production") {
        throw new TransactionNotSupportedError("MongoDB is disconnected in production environment.");
      }
      return await operation({} as ClientSession);
    }

    let session: ClientSession;
    try {
      session = await mongoose.startSession();
    } catch (err: any) {
      if (
        err?.message?.includes("replica set") ||
        err?.message?.includes("Transaction numbers are only allowed on a replica set") ||
        err?.code === 20
      ) {
        throw new TransactionNotSupportedError(
          `MongoDB transactions are not supported on this deployment: ${err.message}`,
        );
      }
      throw err;
    }

    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result!;
    } catch (err: any) {
      if (
        err?.message?.includes("replica set") ||
        err?.message?.includes("Transaction numbers are only allowed on a replica set") ||
        err?.code === 20
      ) {
        throw new TransactionNotSupportedError(
          `MongoDB transactions are not supported on this deployment: ${err.message}`,
        );
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
