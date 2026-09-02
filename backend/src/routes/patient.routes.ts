import { Router } from "express";

import {
  getMyPatientProfile,
  updateMyPatientProfile,
} from "../controllers/patient.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/me", protect, authorize("patient"), getMyPatientProfile);
router.put("/me", protect, authorize("patient"), updateMyPatientProfile);

export default router;
