import { Router } from "express";

import {
  getAllAdmins,
  getAllDoctors,
  getAllPatients,
  getAllUsers,
} from "../controllers/admin.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/users", protect, authorize("admin"), getAllUsers);
router.get("/patients", protect, authorize("admin"), getAllPatients);
router.get("/doctors", protect, authorize("admin"), getAllDoctors);
router.get("/admins", protect, authorize("admin"), getAllAdmins);

export default router;
