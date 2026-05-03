const { cloudinary, isCloudinaryConfigured } = require("../config/cloudinary");

const uploadImage = async (req, res, next) => {
  try {
    if (!isCloudinaryConfigured) {
      return res.status(503).json({
        success: false,
        message: "Cloudinary credentials are missing. Configure CLOUDINARY_* in backend/.env."
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: process.env.CLOUDINARY_FOLDER || "store" },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    res.status(201).json({
      success: true,
      message: "Image uploaded",
      imageUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadImage };
