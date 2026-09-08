import { Router, Request, Response } from "express";
import DoctorModel from "../models/doctor.model.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const rawSpecializations = await DoctorModel.distinct("specialization", {
      specialization: { $exists: true, $ne: "" },
      active: { $ne: false },
      verificationStatus: "verified",
    });

    const filtered = rawSpecializations
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim())
      .sort((a, b) => a.localeCompare(b));

    const unique = Array.from(new Set(filtered));

    return res.status(200).json({
      success: true,
      specializations: unique,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch specializations",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
