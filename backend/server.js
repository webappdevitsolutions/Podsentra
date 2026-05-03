const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const CASHFREE_ENV = (process.env.CASHFREE_ENV || "sandbox").toLowerCase();
const CASHFREE_BASE_URL =
  CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
const CASHFREE_API_VERSION = "2023-08-01";

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5500,http://127.0.0.1:5500")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "API is running" });
});

app.post("/api/cashfree/create-order", async (req, res) => {
  try {
    if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: "Cashfree credentials are missing. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY."
      });
    }

    const {
      orderAmount,
      customerName,
      customerEmail,
      customerPhone,
      returnUrl,
      orderNote
    } = req.body;

    if (!orderAmount || Number(orderAmount) <= 0) {
      return res.status(400).json({ success: false, message: "A valid order amount is required." });
    }

    const orderId = `order_${Date.now()}`;
    const payload = {
      order_id: orderId,
      order_amount: Number(orderAmount),
      order_currency: "INR",
      customer_details: {
        customer_id: `cust_${Date.now()}`,
        customer_name: customerName || "Guest User",
        customer_email: customerEmail || "guest@example.com",
        customer_phone: customerPhone || "9999999999"
      },
      order_meta: {
        return_url: returnUrl || "http://localhost:5500/checkout.html?order_id={order_id}"
      },
      order_note: orderNote || "Store order"
    };

    const response = await fetch(`${CASHFREE_BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": process.env.CASHFREE_APP_ID,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data.message || data.type || "Cashfree order creation failed",
        details: data
      });
    }

    res.status(201).json({
      success: true,
      orderId: data.order_id,
      cfOrderId: data.cf_order_id,
      paymentSessionId: data.payment_session_id,
      orderStatus: data.order_status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to create Cashfree order",
      error: error.message
    });
  }
});

app.post("/api/cashfree/verify-payment", async (req, res) => {
  try {
    if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: "Cashfree credentials are missing. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY."
      });
    }

    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required." });
    }

    const response = await fetch(`${CASHFREE_BASE_URL}/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
      headers: {
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": process.env.CASHFREE_APP_ID,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data.message || data.type || "Cashfree payment verification failed",
        details: data
      });
    }

    res.json({
      success: data.order_status === "PAID",
      orderId: data.order_id,
      cfOrderId: data.cf_order_id,
      orderStatus: data.order_status,
      paymentSessionId: data.payment_session_id,
      orderAmount: data.order_amount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to verify Cashfree payment",
      error: error.message
    });
  }
});

const docsPath = path.join(__dirname, "..", "docs");
app.use(express.static(docsPath));

app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Server error"
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Cashfree mode: ${CASHFREE_ENV}`);
});
