import { Request, Response } from "express";
import { hospitalService } from "../container.js";

export const getActiveHospitals = async (req: Request, res: Response) => {
  try {
    const hospitals = await hospitalService.getActiveHospitals();
    return res.status(200).json({ success: true, hospitals });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: err.message || "Unable to fetch hospitals" });
  }
};

export const getAllHospitals = async (req: Request, res: Response) => {
  try {
    const hospitals = await hospitalService.getAllHospitals();
    return res.status(200).json({ success: true, hospitals });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: err.message || "Unable to fetch hospitals" });
  }
};

export const getHospitalById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const hospital = await hospitalService.getHospitalById(id);
    return res.status(200).json({ success: true, hospital });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: err.message || "Unable to fetch hospital" });
  }
};

export const createHospital = async (req: Request, res: Response) => {
  try {
    const hospital = await hospitalService.createHospital(req.body || {});
    return res.status(201).json({ success: true, hospital });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Hospital with this name already exists" });
    }
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: err.message || "Unable to create hospital" });
  }
};

export const updateHospitalById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const hospital = await hospitalService.updateHospitalById(id, req.body || {});
    return res.status(200).json({ success: true, hospital });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Hospital with this name already exists" });
    }
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: err.message || "Unable to update hospital" });
  }
};

export const toggleHospitalStatus = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const hospital = await hospitalService.toggleHospitalStatus(id);
    return res.status(200).json({
      success: true,
      message: hospital.isActive ? "Hospital activated" : "Hospital deactivated",
      hospital,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: err.message || "Unable to update status" });
  }
};

export const verifyHospital = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status = "verified" } = req.body;
    const hospital = await hospitalService.verifyHospital(id, status);
    return res.status(200).json({
      success: true,
      message: `Hospital verification status updated to ${status}`,
      hospital,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: err.message || "Unable to update verification status" });
  }
};
