import { Router } from "express";
import {
  getMyAppointments,
  createAppointment,
} from "../controllers/appointment.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/my", protect, getMyAppointments);
router.post("/", protect, createAppointment);

export default router;
