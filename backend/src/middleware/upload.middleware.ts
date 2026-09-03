import type { NextFunction, Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import multer, { type FileFilterCallback, type Multer } from "multer";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
  upload.single("profileImage")(req, res, async (error: unknown) => {
    if (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      return res.status(400).json({
        success: false,
        message,
      });
    }

    const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;

    if (!uploadedFile) {
      return next();
    }

    try {
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "helthgate/profile-images",
            transformation: [{ quality: "auto", fetch_format: "auto" }],
          },
          (errorResult, uploadResult) => {
            if (errorResult) {
              reject(errorResult);
              return;
            }

            if (!uploadResult) {
              reject(new Error("Cloudinary upload failed"));
              return;
            }

            resolve(uploadResult as { secure_url: string });
          },
        );

        stream.end(uploadedFile.buffer);
      });

      req.body.profileImage = result.secure_url;
      return next();
    } catch (uploadError) {
      return res.status(500).json({
        success: false,
        message:
          uploadError instanceof Error
            ? uploadError.message
            : "Profile image upload failed",
      });
    }
  });
};
