import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/auth.js";
import { paymentService } from "../container.js";
import { parsePagination } from "../utils/pagination.js";

export const createPaymentOrder = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const patientUserId = req.user?.id;
    if (!patientUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { bookingId, appointmentId } = req.body;
    const targetBookingId = bookingId || appointmentId;

    if (!targetBookingId) {
      return res.status(400).json({
        success: false,
        message: "bookingId or appointmentId is required",
      });
    }

    const result = await paymentService.createPaymentOrder({
      patientUserId,
      bookingId: targetBookingId,
    });

    return res.status(201).json({
      success: true,
      message: "Payment order created successfully",
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to create payment order",
      error: error.message || "Unknown error",
    });
  }
};

export const verifyPayment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const patientUserId = req.user?.id;
    if (!patientUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      paymentId,
      providerOrderId,
      providerPaymentId,
      razorpaySignature,
      simulateStatus,
      failureReason,
      mockToken,
    } = req.body;

    if (!paymentId && !providerOrderId) {
      return res.status(400).json({
        success: false,
        message: "Either paymentId or providerOrderId is required for verification",
      });
    }

    const result = await paymentService.verifyPayment({
      patientUserId,
      paymentId,
      providerOrderId,
      providerPaymentId,
      razorpaySignature,
      simulateStatus,
      failureReason,
      mockToken,
    });

    return res.status(200).json({
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Payment verification failed",
      error: error.message || "Unknown error",
    });
  }
};

export const retryPayment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const patientUserId = req.user?.id;
    if (!patientUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const rawId = req.params.id;
    if (!rawId) {
      return res.status(400).json({
        success: false,
        message: "Payment ID parameter is required",
      });
    }
    const paymentId = String(rawId);

    const result = await paymentService.retryPayment({
      patientUserId,
      paymentId,
    });

    return res.status(201).json({
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retry payment",
      error: error.message || "Unknown error",
    });
  }
};

export const getPaymentHistory = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const patientUserId = req.user?.id;
    const role = req.user?.role || "patient";

    if (!patientUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const status = req.query.status as string | undefined;
    const { page, limit } = parsePagination(req.query, 10);

    const result = await paymentService.getPaymentHistory({
      patientUserId,
      role,
      status,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      ...result,
      payments: result.data || result.payments,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch payment history",
      error: error.message || "Unknown error",
    });
  }
};

export const getPaymentById = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const patientUserId = req.user?.id;
    const role = req.user?.role || "patient";

    if (!patientUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const paymentId = String(req.params.id);
    const payment = await paymentService.getPaymentById({
      patientUserId,
      role,
      paymentId,
    });

    return res.status(200).json({
      success: true,
      payment,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch payment",
      error: error.message || "Unknown error",
    });
  }
};

export const handleWebhook = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    const payload = req.body;

    const result = await paymentService.handleWebhook({
      signature,
      payload,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Webhook processing failed",
    });
  }
};
