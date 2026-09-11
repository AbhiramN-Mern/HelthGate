import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import patientRoutes from "./routes/patient.routes.js";
import hospitalRoutes from './routes/hospital.routes.js'
import appointmentRoutes from "./routes/appointment.routes.js";
import specializationRoutes from "./routes/specialization.routes.js";
import paymentRoutes from "./routes/payment.routes.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/specializations", specializationRoutes);
app.use("/api/payments", paymentRoutes);


// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "HealthGate API is running",
  });
});

export default app;
