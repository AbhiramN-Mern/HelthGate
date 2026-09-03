import { Router } from "express";

import {
  getAllAdmins,
  getAllDoctors,
  getAllPatients,
  getAllUsers,
  getDoctorById,
  getPatientById,
  rejectDoctor,
  togglePatientStatus,
  updateDoctorById,
  updatePatientById,
  verifyDoctor,
} from "../controllers/admin.controller.js";
import { adminOnly, protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/users", protect, adminOnly, getAllUsers);
router.get("/patients", protect, adminOnly, getAllPatients);
router.get("/patients/:id", protect, adminOnly, getPatientById);
router.put("/patients/:id", protect, adminOnly, updatePatientById);
router.patch("/patients/:id/status", protect, adminOnly, togglePatientStatus);
router.get("/doctors", protect, adminOnly, getAllDoctors);
router.get("/doctors/:id", protect, adminOnly, getDoctorById);
router.put("/doctors/:id", protect, adminOnly, updateDoctorById);
router.patch("/doctors/:id/verify", protect, adminOnly, verifyDoctor);
router.patch("/doctors/:id/reject", protect, adminOnly, rejectDoctor);
router.get("/admins", protect, adminOnly, getAllAdmins);

export default router;
