import type { NextFunction, Request, Response } from "express";
import multer, { type FileFilterCallback, type Multer } from "multer";

const storage = multer.memoryStorage();
const upload: Multer = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    callback: FileFilterCallback,
  ) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Only image files are allowed"));
      return;
    }

    callback(null, true);
  },
});

export const uploadProfileImage = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload.single("profileImage")(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      return res.status(400).json({
        success: false,
        message,
      });
    }

    const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;

    if (uploadedFile && typeof req.body?.profileImage !== "string") {
      const base64 = `data:${uploadedFile.mimetype};base64,${uploadedFile.buffer.toString("base64")}`;
      req.body.profileImage = base64;
    }

    return next();
  });
};
