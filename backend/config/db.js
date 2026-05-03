const mongoose = require("mongoose");
const dns = require("dns");
const { MongoMemoryServer } = require("mongodb-memory-server");

let memoryServer = null;

const connectDB = async () => {
  const isProduction = (process.env.NODE_ENV || "").toLowerCase() === "production";
  const mongoUri = process.env.MONGO_URI || "";

  if (mongoUri.startsWith("mongodb+srv://")) {
    const dnsServers = (process.env.ATLAS_DNS_SERVERS || "8.8.8.8,1.1.1.1")
      .split(",")
      .map((server) => server.trim())
      .filter(Boolean);
    try {
      dns.setServers(dnsServers);
      console.log(`DNS servers set for Atlas SRV lookup: ${dnsServers.join(", ")}`);
    } catch (error) {
      console.warn(`Could not set custom DNS servers: ${error.message}`);
    }
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("MongoDB connected");
    return { mode: "external", uri: mongoUri };
  } catch (error) {
    const fallbackEnabledByEnv = (process.env.MONGO_FALLBACK_MEMORY || "true").toLowerCase() === "true";
    const shouldFallback = !isProduction && fallbackEnabledByEnv;
    const isConnectionIssue =
      error.name === "MongoServerSelectionError" ||
      String(error.message || "").includes("ECONNREFUSED");

    if (!shouldFallback || !isConnectionIssue) {
      console.error(
        "MongoDB connection failed:",
        error.message,
        "| Check MONGO_URI and ensure MongoDB is running."
      );
      if (isProduction) {
        if (fallbackEnabledByEnv) {
          console.error(
            "MONGO_FALLBACK_MEMORY is ignored in production. Fallback is always disabled when NODE_ENV=production."
          );
        }
        console.error(
          "In production, in-memory fallback is disabled. Set a valid MongoDB Atlas/managed MONGO_URI."
        );
      }
      process.exit(1);
    }

    console.warn(
      "MongoDB is not reachable at MONGO_URI. Falling back to in-memory MongoDB for local testing."
    );
    memoryServer = await MongoMemoryServer.create();
    const memoryUri = memoryServer.getUri();
    await mongoose.connect(memoryUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("MongoDB connected (in-memory fallback)");
    return { mode: "memory", uri: memoryUri };
  }
};

module.exports = connectDB;
