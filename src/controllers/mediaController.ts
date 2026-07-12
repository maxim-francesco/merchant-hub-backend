import { Request, Response } from 'express';
import cloudinary from '../lib/cloudinary';

export const uploadMedia = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ status: 'error', message: 'No file uploaded.' });
    return;
  }

  // Extract tenantId if available from previous middleware, otherwise use a default
  const tenantId = (req as any).tenantId || 'global';

  const uploadStream = cloudinary.uploader.upload_stream(
    { 
      resource_type: "image", 
      folder: `merchant-hub/${tenantId}/products`,
      format: 'webp' // Auto-convert to webp for performance
    },
    (error, result) => {
      if (error || !result) {
        console.error("Cloudinary upload error:", error);
        res.status(500).json({ status: 'error', message: 'Cloudinary upload failed.' });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: { url: result.secure_url }
      });
    }
  );

  uploadStream.end(req.file.buffer);
};
