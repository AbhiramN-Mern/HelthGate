import { Router } from "express";
import {
  getMyAppointments,
  createAppointment,
  getBookedSlots,
} from "../controllers/appointment.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/my", protect, getMyAppointments);
router.get("/booked-slots", protect, getBookedSlots);
router.post("/", protect, createAppointment);

export default router;

