const User = require("../models/User");

const ensureAdminFromEnv = async () => {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.log("Admin bootstrap skipped (ADMIN_EMAIL or ADMIN_PASSWORD not set)");
    return { status: "skipped_missing_env" };
  }

  const existingAdmin = await User.findOne({ isAdmin: true });
  if (!existingAdmin) {
    await User.create({
      name: process.env.ADMIN_NAME || "Store Admin",
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      isAdmin: true
    });
    console.log("First admin user created from environment variables");
    return { status: "created" };
  }

  const envAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL.toLowerCase() });
  if (envAdmin && !envAdmin.isAdmin) {
    envAdmin.isAdmin = true;
    await envAdmin.save();
    console.log("Configured ADMIN_EMAIL user promoted to admin");
    return { status: "promoted" };
  }

  console.log("Admin bootstrap completed (existing admin retained)");
  return { status: "existing" };
};

module.exports = ensureAdminFromEnv;
