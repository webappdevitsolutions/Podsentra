const dotenv = require("dotenv");
const connectDB = require("../config/db");
const User = require("../models/User");

dotenv.config();

const run = async () => {
  await connectDB();

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required in .env");
    process.exit(1);
  }

  const existing = await User.findOne({ email: process.env.ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    existing.isAdmin = true;
    await existing.save();
    console.log("Existing user promoted to admin");
  } else {
    await User.create({
      name: process.env.ADMIN_NAME || "Store Admin",
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      isAdmin: true
    });
    console.log("Admin user created");
  }

  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
