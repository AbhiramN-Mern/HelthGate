import { Router } from "express";
import {
  savePrescription,
  getPrescriptionByAppointment,
  getMyPrescriptions,
} from "../controllers/prescription.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";

const router = Router();

// Logged-in user gets their prescriptions list
router.get("/my", protect, getMyPrescriptions);

// Get prescription for appointment
router.get("/appointment/:appointmentId", protect, getPrescriptionByAppointment);

// Doctor creates or updates prescription for appointment
router.post(
  "/appointment/:appointmentId",
  protect,
  authorize("doctor"),
  savePrescription,
);

export default router;
