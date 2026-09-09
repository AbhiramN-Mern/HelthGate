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
} from "../controllers/doctor.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";
import { uploadProfileImage } from "../middleware/upload.middleware.js";

const router = Router();

router.get("/", protect, getAvailableDoctors);
router.get("/dashboard", protect, authorize("doctor"), getDoctorDashboard);
router.put("/availability", protect, authorize("doctor"), updateDoctorAvailability);
router.patch("/appointments/:appointmentId/status", protect, authorize("doctor"), updateAppointmentStatusForDoctor);
router.get("/patients/:patientId", protect, authorize("doctor"), getDoctorPatientDetails);
router.patch("/notifications/:notificationId/read", protect, authorize("doctor"), markNotificationRead);

// Doctor Hospital Affiliation Routes
router.get("/me/hospitals", protect, authorize("doctor"), getMyDoctorHospitals);
router.get("/hospitals/search", protect, authorize("doctor"), searchHospitalsForDoctor);
router.post("/hospitals/request", protect, authorize("doctor"), requestJoinHospital);

router.get("/me", protect, authorize("doctor"), getMyDoctorProfile);
router.put(
  "/me",
  protect,
  authorize("doctor"),
  uploadProfileImage,
  updateMyDoctorProfile,
);

export default router;
