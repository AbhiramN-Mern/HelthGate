import { Router } from "express";

import {
  getMyPatientProfile,
  updateMyPatientProfile,
} from "../controllers/patient.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";
import { uploadProfileImage } from "../middleware/upload.middleware.js";

const router = Router();

router.get("/me", protect, authorize("patient"), getMyPatientProfile);
router.put(
  "/me",
  protect,
  authorize("patient"),
  uploadProfileImage,
  updateMyPatientProfile,
);

export default router;
