import { Router } from "express";

import {
  getAllAdmins,
  getAllDoctors,
  getAllPatients,
  getAllUsers,
  getPatientById,
  togglePatientStatus,
} from "../controllers/admin.controller.js";
import { adminOnly, protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/users", protect, adminOnly, getAllUsers);
router.get("/patients", protect, adminOnly, getAllPatients);
router.get("/patients/:id", protect, adminOnly, getPatientById);
router.patch("/patients/:id/status", protect, adminOnly, togglePatientStatus);
router.get("/doctors", protect, adminOnly, getAllDoctors);
router.get("/admins", protect, adminOnly, getAllAdmins);

export default router;
