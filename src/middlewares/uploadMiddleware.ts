import multer from 'multer';

const storage = multer.memoryStorage();

const imageFilter = (req: any, file: any, cb: any) => {
  const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowedImageTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed."), false);
  }
};

export const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for luxury fast loading
  fileFilter: imageFilter,
});
