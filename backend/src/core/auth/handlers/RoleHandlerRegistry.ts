import { UserRole } from "../../../types/auth.js";
import { IRoleHandler } from "../IRoleHandler.js";
import { BadRequestError } from "../../errors/AppError.js";

export class RoleHandlerRegistry {
  private handlers = new Map<UserRole, IRoleHandler>();

  register(role: UserRole, handler: IRoleHandler): void {
    this.handlers.set(role, handler);
  }

  getHandler(role: UserRole): IRoleHandler {
    const handler = this.handlers.get(role);
    if (!handler) {
      throw new BadRequestError(`No handler registered for role: ${role}`);
    }
    return handler;
  }

  hasRole(role: string): role is UserRole {
    return this.handlers.has(role as UserRole);
  }
}
