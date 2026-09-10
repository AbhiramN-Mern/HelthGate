import type { Request, Response } from "express";
import { adminService } from "../container.js";

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await adminService.getAllUsers();
    return res.status(200).json({ success: true, users });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch users",
      error: error.message || "Unknown error",
    });
  }
};

export const getAllPatients = async (req: Request, res: Response) => {
  try {
    const patients = await adminService.getAllPatients();
    return res.status(200).json({ success: true, patients });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch patients",
      error: error.message || "Unknown error",
    });
  }
};

export const getPatientById = async (req: Request, res: Response) => {
  try {
    const patient = await adminService.getPatientById(String(req.params.id));
    return res.status(200).json({ success: true, patient });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch patient details",
      error: error.message || "Unknown error",
    });
  }
};

export const togglePatientStatus = async (req: Request, res: Response) => {
  try {
    const patient = await adminService.togglePatientStatus(String(req.params.id));
    return res.status(200).json({
      success: true,
      message: patient.active ? "Patient activated" : "Patient deactivated",
      patient,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update patient status",
      error: error.message || "Unknown error",
    });
  }
};

export const updatePatientById = async (req: Request, res: Response) => {
  try {
    const patient = await adminService.updatePatientById(String(req.params.id), req.body || {});
    return res.status(200).json({
      success: true,
      message: "Patient profile updated successfully",
      patient,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update patient",
      error: error.message || "Unknown error",
    });
  }
};

export const getAllDoctors = async (req: Request, res: Response) => {
  try {
    const doctors = await adminService.getAllDoctors();
    return res.status(200).json({ success: true, doctors });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch doctors",
      error: error.message || "Unknown error",
    });
  }
};

export const getDoctorById = async (req: Request, res: Response) => {
  try {
    const doctor = await adminService.getDoctorById(String(req.params.id));
    return res.status(200).json({ success: true, doctor });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch doctor details",
      error: error.message || "Unknown error",
    });
  }
};

export const createDoctor = async (req: Request, res: Response) => {
  try {
    const result = await adminService.createDoctor(req.body || {});
    return res.status(201).json({
      success: true,
      message: "Doctor created successfully",
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to create doctor",
      error: error.message || "Unknown error",
    });
  }
};

export const updateDoctorById = async (req: Request, res: Response) => {
  try {
    const doctor = await adminService.updateDoctorById(String(req.params.id), req.body || {});
    return res.status(200).json({
      success: true,
      message: "Doctor profile updated successfully",
      doctor,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update doctor profile",
      error: error.message || "Unknown error",
    });
  }
};

export const toggleDoctorStatus = async (req: Request, res: Response) => {
  try {
    const doctor = await adminService.toggleDoctorStatus(String(req.params.id));
    return res.status(200).json({
      success: true,
      message: doctor.active ? "Doctor activated" : "Doctor deactivated",
      doctor,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update doctor status",
      error: error.message || "Unknown error",
    });
  }
};

export const verifyDoctor = async (req: Request, res: Response) => {
  try {
    const doctor = await adminService.verifyDoctor(String(req.params.id));
    return res.status(200).json({
      success: true,
      message: "Doctor verified successfully",
      doctor,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to verify doctor",
      error: error.message || "Unknown error",
    });
  }
};

export const rejectDoctor = async (req: Request, res: Response) => {
  try {
    const { reason } = req.body || {};
    const doctor = await adminService.rejectDoctor(String(req.params.id), reason);
    return res.status(200).json({
      success: true,
      message: "Doctor verification rejected",
      doctor,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to reject doctor",
      error: error.message || "Unknown error",
    });
  }
};

export const deleteDoctor = async (req: Request, res: Response) => {
  try {
    await adminService.deleteDoctor(String(req.params.id));
    return res.status(200).json({
      success: true,
      message: "Doctor deleted successfully",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to delete doctor",
      error: error.message || "Unknown error",
    });
  }
};

export const getAllAdmins = async (req: Request, res: Response) => {
  try {
    const admins = await adminService.getAllAdmins();
    return res.status(200).json({ success: true, admins });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch admins",
      error: error.message || "Unknown error",
    });
  }
};

export const getAdminDashboard = async (req: Request, res: Response) => {
  try {
    const dashboard = await adminService.getAdminDashboard();
    return res.status(200).json({ success: true, ...dashboard });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch dashboard metrics",
      error: error.message || "Unknown error",
    });
  }
};

export const getAllAppointmentsForAdmin = async (req: Request, res: Response) => {
  try {
    const { status, doctor, hospital, date } = req.query;
    const query: Record<string, unknown> = {};

    if (status && typeof status === "string") query.status = status;
    if (doctor && typeof doctor === "string") query.doctor = doctor;
    if (hospital && typeof hospital === "string") query.hospital = hospital;
    if (date && typeof date === "string") {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.appointmentDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const appointments = await adminService.getAllAppointmentsForAdmin(query);
    return res.status(200).json({ success: true, appointments });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch appointments",
      error: error.message || "Unknown error",
    });
  }
};

export const getAllHospitalDoctorsForAdmin = async (req: Request, res: Response) => {
  try {
    const hospitalDoctors = await adminService.getAllHospitalDoctorsForAdmin();
    return res.status(200).json({ success: true, hospitalDoctors });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch hospital doctor associations",
      error: error.message || "Unknown error",
    });
  }
};

export const getHospitalDoctorHistory = async (req: Request, res: Response) => {
  try {
    const history = await adminService.getHospitalDoctorHistory();
    return res.status(200).json({ success: true, history });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch association history",
      error: error.message || "Unknown error",
    });
  }
};

export const associateDoctorWithHospital = async (req: Request, res: Response) => {
  try {
    const { doctorId, hospitalId, department = "" } = req.body;
    const relation = await adminService.associateDoctorWithHospital({
      doctorId,
      hospitalId,
      department,
    });

    return res.status(200).json({
      success: true,
      message: "Doctor successfully associated with hospital",
      association: relation,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to associate doctor with hospital",
      error: error.message || "Unknown error",
    });
  }
};

export const approveDoctorHospitalRequest = async (req: Request, res: Response) => {
  try {
    const relation = await adminService.approveDoctorHospitalRequest(String(req.params.id));
    return res.status(200).json({
      success: true,
      message: "Doctor hospital request approved",
      association: relation,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to approve request",
      error: error.message || "Unknown error",
    });
  }
};

export const rejectDoctorHospitalRequest = async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const relation = await adminService.rejectDoctorHospitalRequest(String(req.params.id), reason);
    return res.status(200).json({
      success: true,
      message: "Doctor hospital request rejected",
      association: relation,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to reject request",
      error: error.message || "Unknown error",
    });
  }
};

export const removeDoctorFromHospital = async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const relation = await adminService.removeDoctorFromHospital(String(req.params.id), reason);
    return res.status(200).json({
      success: true,
      message: "Doctor removed from hospital",
      association: relation,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to remove doctor from hospital",
      error: error.message || "Unknown error",
    });
  }
};
