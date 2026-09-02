import type { Request } from "express";

export type UserRole = "patient" | "doctor" | "admin";

export type JwtPayload = {
  id: string;
  role: UserRole;
};

export type AuthenticatedRequest = Request & {
  user?: JwtPayload;
};
