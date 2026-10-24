import multer from "multer";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const imageMaxSize = 200 * 1024;
const pdfMaxSize = 200 * 1024;

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      throw new Error("Unsupported file type. Upload JPG, PNG, WEBP or PDF files only.");
    }
    const isPdf = file.mimetype === "application/pdf";
    const safeName = file.originalname.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9.-]/g, "_");
    return {
      folder: "academy-management/documents",
      
      resource_type: isPdf ? "raw" : "image",
      public_id: `${Date.now()}-${safeName}${isPdf ? ".pdf" : ""}`
    };
  }
});

storage.upload = async (options, file) => {
  const maxSize = file.mimetype === "application/pdf" ? pdfMaxSize : imageMaxSize;
  let size = 0;
  const sizeLimiter = new Transform({
    transform(chunk, encoding, callback) {
      size += chunk.length;
      if (size > maxSize) {
        const error = new multer.MulterError("LIMIT_FILE_SIZE", file.fieldname);
        error.limit = maxSize;
        callback(error);
        return;
      }
      callback(null, chunk);
    }
  });

  let uploadStream;
  const response = new Promise((resolve, reject) => {
    uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });

  const [, result] = await Promise.all([
    pipeline(file.stream, sizeLimiter, uploadStream),
    response
  ]);
  return result;
};

const upload = multer({
  storage,
  limits: { fileSize: pdfMaxSize, files: 20 }
});

export default upload;
