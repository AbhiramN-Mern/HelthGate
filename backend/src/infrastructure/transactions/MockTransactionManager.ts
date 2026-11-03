import type { ClientSession } from "mongoose";
import type { ITransactionManager } from "../../core/transactions/ITransactionManager.js";

export class MockTransactionManager implements ITransactionManager {
  private sessionMock: ClientSession;

  constructor(sessionMock?: ClientSession) {
    this.sessionMock = sessionMock || ({} as ClientSession);
  }

  async executeTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    return await operation(this.sessionMock);
  }
}
