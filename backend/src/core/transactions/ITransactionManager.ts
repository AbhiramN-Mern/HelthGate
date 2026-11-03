import type { ClientSession } from "mongoose";

export interface ITransactionManager {
  executeTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T>;
}

