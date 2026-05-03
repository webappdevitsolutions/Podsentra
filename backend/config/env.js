const LOCALHOST_ORIGINS = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
];

const splitCsv = (value) =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const validateEnv = () => {
  const required = ["MONGO_URI", "JWT_SECRET"];
  const missingRequired = required.filter((key) => !process.env[key]);

  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingRequired.join(", ")}. ` +
        "Create backend/.env using backend/.env.example. " +
        "Use local MongoDB URI like mongodb://127.0.0.1:27017/storedb " +
        "or MongoDB Atlas URI like mongodb+srv://<user>:<pass>@<cluster>/<db>."
    );
  }

  const configuredOrigins = [
    ...splitCsv(process.env.CLIENT_URL),
    ...splitCsv(process.env.CORS_ORIGINS),
    ...splitCsv(process.env.FRONTEND_URL)
  ];
  const corsOrigins = [...new Set([...LOCALHOST_ORIGINS, ...configuredOrigins])];

  const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
  const adminBootstrapConfigured = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);

  if (!adminBootstrapConfigured) {
    console.warn(
      "[Startup] ADMIN_EMAIL or ADMIN_PASSWORD missing. First admin will not be auto-created."
    );
  }
  if (!razorpayConfigured) {
    console.warn("[Startup] Razorpay credentials missing. Razorpay checkout will be unavailable.");
  }
  if (!cloudinaryConfigured) {
    console.warn("[Startup] Cloudinary credentials missing. Image upload API will be unavailable.");
  }

  return {
    port: Number(process.env.PORT || 5000),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    corsOrigins,
    razorpayConfigured,
    cloudinaryConfigured,
    adminBootstrapConfigured
  };
};

module.exports = { validateEnv };
