import { Router } from "express";

import {
  getAvailableDoctors,
  getMyDoctorProfile,
  updateMyDoctorProfile,
} from "../controllers/doctor.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", protect, getAvailableDoctors);
router.get("/me", protect, authorize("doctor"), getMyDoctorProfile);
router.put("/me", protect, authorize("doctor"), updateMyDoctorProfile);

export default router;
