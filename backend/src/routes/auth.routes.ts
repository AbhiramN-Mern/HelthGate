import { Router } from "express";

import {
  getGoogleAuthUrl,
  getMe,
  googleCallback,
  googlePatientAuth,
  login,
  register,
  resendOTP,
  sendOTP,
  verifyOTP,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.post("/send-otp", sendOTP);
router.post("/patient/google", googlePatientAuth);
router.get("/patient/google/url", getGoogleAuthUrl);
router.get("/google/callback", googleCallback);
router.get("/patient/google/callback", googleCallback);
router.get("/me", protect, getMe);

export default router;

