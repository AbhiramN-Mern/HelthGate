import { Router } from "express";
import {
  createPaymentOrder,
  verifyPayment,
  retryPayment,
  getPaymentHistory,
  getPaymentById,
  handleWebhook,
} from "../controllers/payment.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";

const router = Router();

// Order creation, verification, and retry (Patient only)
router.post("/orders", protect, authorize("patient"), createPaymentOrder);
router.post("/verify", protect, authorize("patient"), verifyPayment);
router.post("/:id/retry", protect, authorize("patient"), retryPayment);

// Payment history & individual payment lookup (Patient / Admin)
router.get("/", protect, getPaymentHistory);
router.get("/:id", protect, getPaymentById);

// Public webhook endpoint for asynchronous payment gateway callbacks
router.post("/webhook", handleWebhook);

export default router;
