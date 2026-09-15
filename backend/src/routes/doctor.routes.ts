import { Router } from "express";

import {
  getAvailableDoctors,
  getMyDoctorProfile,
  updateMyDoctorProfile,
  getDoctorDashboard,
  updateDoctorAvailability,
  updateAppointmentStatusForDoctor,
  getDoctorPatientDetails,
  markNotificationRead,
  getMyDoctorHospitals,
  searchHospitalsForDoctor,
  requestJoinHospital,
  getDoctorVerificationStatus,
} from "../controllers/doctor.controller.js";
import { authorize, protect, requireApprovedDoctor } from "../middleware/auth.middleware.js";
import { uploadProfileImage } from "../middleware/upload.middleware.js";

const router = Router();

router.get("/", protect, getAvailableDoctors);

// Doctor verification status (accessible by any authenticated doctor to verify approval)
router.get("/verification-status", protect, authorize("doctor"), getDoctorVerificationStatus);

// Protected Doctor Operational Routes (requires isEmailVerified === true AND doctorApprovalStatus === 'approved')
router.get("/dashboard", protect, requireApprovedDoctor, getDoctorDashboard);
router.put("/availability", protect, requireApprovedDoctor, updateDoctorAvailability);
router.patch("/appointments/:appointmentId/status", protect, requireApprovedDoctor, updateAppointmentStatusForDoctor);
router.get("/patients/:patientId", protect, requireApprovedDoctor, getDoctorPatientDetails);
router.patch("/notifications/:notificationId/read", protect, requireApprovedDoctor, markNotificationRead);

// Doctor Hospital Affiliation Routes (requires approved doctor)
router.get("/me/hospitals", protect, requireApprovedDoctor, getMyDoctorHospitals);
router.get("/hospitals/search", protect, requireApprovedDoctor, searchHospitalsForDoctor);
router.post("/hospitals/request", protect, requireApprovedDoctor, requestJoinHospital);

router.get("/me", protect, authorize("doctor"), getMyDoctorProfile);
router.put(
  "/me",
  protect,
  requireApprovedDoctor,
  uploadProfileImage,
  updateMyDoctorProfile,
);

export default router;
