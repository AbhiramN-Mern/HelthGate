import { Router, Request, Response } from "express";
import { doctorRepo } from "../container.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const unique = await doctorRepo.distinctSpecializations();

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
