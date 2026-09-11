// Infrastructure & Core Security
import { BcryptPasswordHasher } from "./infrastructure/security/BcryptPasswordHasher.js";
import { JwtTokenService } from "./infrastructure/security/JwtTokenService.js";

// Repositories
import { MongoUserRepository } from "./repositories/implementations/MongoUserRepository.js";
import { MongoPatientRepository } from "./repositories/implementations/MongoPatientRepository.js";
import { MongoDoctorRepository } from "./repositories/implementations/MongoDoctorRepository.js";
import { MongoHospitalRepository } from "./repositories/implementations/MongoHospitalRepository.js";
import { MongoHospitalDoctorRepository } from "./repositories/implementations/MongoHospitalDoctorRepository.js";
import { MongoAppointmentRepository } from "./repositories/implementations/MongoAppointmentRepository.js";
import { MongoNotificationRepository } from "./repositories/implementations/MongoNotificationRepository.js";
import { MongoAdminRepository } from "./repositories/implementations/MongoAdminRepository.js";
import { MongoPaymentRepository } from "./repositories/implementations/MongoPaymentRepository.js";

// Gateways & Infrastructure
import { MockPaymentGateway } from "./infrastructure/payment/mock/MockPaymentGateway.js";
import { RazorpayGateway } from "./infrastructure/payment/razorpay/RazorpayGateway.js";

// Role Handlers (OCP)
import { RoleHandlerRegistry } from "./core/auth/handlers/RoleHandlerRegistry.js";
import { PatientRoleHandler } from "./core/auth/handlers/PatientRoleHandler.js";
import { DoctorRoleHandler } from "./core/auth/handlers/DoctorRoleHandler.js";
import { AdminRoleHandler } from "./core/auth/handlers/AdminRoleHandler.js";

// Services
import { AuthService } from "./services/auth.service.js";
import { PatientService } from "./services/patient.service.js";
import { DoctorService } from "./services/doctor.service.js";
import { HospitalService } from "./services/hospital.service.js";
import { AppointmentService } from "./services/appointment.service.js";
import { AdminService } from "./services/admin.service.js";
import { PaymentService } from "./services/payment.service.js";

// 1. Security & Core utilities
export const passwordHasher = new BcryptPasswordHasher();
export const tokenService = new JwtTokenService();

// 2. Gateways
export const mockPaymentGateway = new MockPaymentGateway();
export const razorpayGateway = new RazorpayGateway();
// Active gateway selected based on environment (defaults to MOCK)
export const activePaymentGateway =
  process.env.PAYMENT_GATEWAY === "RAZORPAY" ? razorpayGateway : mockPaymentGateway;

// 3. Repositories
export const userRepo = new MongoUserRepository();
export const patientRepo = new MongoPatientRepository();
export const doctorRepo = new MongoDoctorRepository();
export const hospitalRepo = new MongoHospitalRepository();
export const hospitalDoctorRepo = new MongoHospitalDoctorRepository();
export const appointmentRepo = new MongoAppointmentRepository();
export const notificationRepo = new MongoNotificationRepository();
export const adminRepo = new MongoAdminRepository();
export const paymentRepo = new MongoPaymentRepository();

// 4. Role Handlers & Registry
export const roleRegistry = new RoleHandlerRegistry();
roleRegistry.register("patient", new PatientRoleHandler(patientRepo));
roleRegistry.register("doctor", new DoctorRoleHandler(doctorRepo));
roleRegistry.register("admin", new AdminRoleHandler(adminRepo));

// 5. Services (Wired with Inverted Dependencies)
export const authService = new AuthService(userRepo, passwordHasher, tokenService, roleRegistry);
export const patientService = new PatientService(patientRepo, notificationRepo);
export const hospitalService = new HospitalService(hospitalRepo, hospitalDoctorRepo);
export const doctorService = new DoctorService(
  doctorRepo,
  appointmentRepo,
  notificationRepo,
  hospitalRepo,
  hospitalDoctorRepo,
  userRepo,
  patientRepo,
);
export const appointmentService = new AppointmentService(
  appointmentRepo,
  doctorRepo,
  hospitalDoctorRepo,
  notificationRepo,
  userRepo,
);
export const adminService = new AdminService(
  userRepo,
  patientRepo,
  doctorRepo,
  hospitalRepo,
  hospitalDoctorRepo,
  appointmentRepo,
  notificationRepo,
  adminRepo,
  passwordHasher,
);
export const paymentService = new PaymentService(
  paymentRepo,
  appointmentRepo,
  doctorRepo,
  notificationRepo,
  userRepo,
  activePaymentGateway,
);

