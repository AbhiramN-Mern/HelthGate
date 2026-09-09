import { Router } from "express";
import {
  getMyAppointments,
  createAppointment,
  getBookedSlots,
  requestAppointmentReschedule,
  respondAppointmentReschedule,
} from "../controllers/appointment.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/my", protect, getMyAppointments);
router.get("/booked-slots", protect, getBookedSlots);
router.post("/", protect, createAppointment);

// Reschedule endpoints
router.post(
  "/:appointmentId/reschedule",
  protect,
  authorize("doctor"),
  requestAppointmentReschedule,
);
router.patch(
  "/:appointmentId/reschedule/respond",
  protect,
  authorize("patient"),
  respondAppointmentReschedule,
);

export default router;

