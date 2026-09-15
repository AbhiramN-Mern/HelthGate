import type { NextFunction, Request, Response } from "express";
import { AppError } from "../core/errors/AppError.js";

/**
 * 404 Not Found handler for unmatched API routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
};

/**
 * Global error handling middleware
 * Catches operational AppErrors, Mongoose validation/cast errors, JWT errors,
 * and handles unexpected 500 errors safely without exposing server internals or stack traces.
 */
export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // 1. Known Operational AppErrors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...((err as any).requiresEmailVerification ? { requiresEmailVerification: true, email: (err as any).email } : {}),
    });
  }

  // 2. Mongoose Invalid ObjectId CastError (e.g. invalid appointment or user ID)
  if (err?.name === "CastError" || err?.kind === "ObjectId") {
    const field = err.path || "id";
    return res.status(400).json({
      success: false,
      message: `Invalid ID format for parameter: ${field}`,
    });
  }

  // 3. Mongoose Schema Validation Error
  if (err?.name === "ValidationError") {
    const messages = Object.values(err.errors || {}).map(
      (e: any) => e.message || "Invalid input",
    );
    return res.status(400).json({
      success: false,
      message: messages.join(". ") || "Validation failed",
      errors: messages,
    });
  }

  // 4. MongoDB Duplicate Key Error (E11000)
  if (err?.code === 11000) {
    const keys = Object.keys(err.keyValue || {}).join(", ");
    return res.status(409).json({
      success: false,
      message: keys
        ? `Duplicate record already exists for ${keys}`
        : "Duplicate record already exists",
    });
  }

  // 5. JWT Token Expired
  if (err?.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Your session has expired. Please log in again.",
    });
  }

  // 6. JWT Invalid Token
  if (err?.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token. Please log in again.",
    });
  }

  // 7. General Server Errors
  const statusCode = err?.statusCode || (typeof err?.status === "number" ? err.status : 500);
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    console.error("[ErrorHandler]", err);
  }

  return res.status(statusCode).json({
    success: false,
    message: err?.message || "An unexpected internal server error occurred",
    ...(isProduction ? {} : { stack: err?.stack }),
  });
};
