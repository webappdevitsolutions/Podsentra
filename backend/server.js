const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const CASHFREE_ENV = (process.env.CASHFREE_ENV || "sandbox").toLowerCase();
const CASHFREE_BASE_URL =
  CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
const CASHFREE_API_VERSION = "2023-08-01";
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "product-images";
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "podsecntra_admin_secret_change_me";
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "admin@podsecntra.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change_me";

const defaultProducts = [
  {
    name: "Classic White Sneakers",
    category: "Footwear",
    price: 79.99,
    rating: 4.6,
    stock: 18,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80",
    description: "Clean low-top sneakers with cushioned insole for all-day comfort."
  },
  {
    name: "Minimal Leather Backpack",
    category: "Accessories",
    price: 119.99,
    rating: 4.7,
    stock: 9,
    image: "https://images.unsplash.com/photo-1491637639811-60e2756cc1c7?auto=format&fit=crop&w=900&q=80",
    description: "Structured backpack with laptop sleeve and water-resistant lining."
  },
  {
    name: "Linen Blend Shirt",
    category: "Apparel",
    price: 49.5,
    rating: 4.3,
    stock: 30,
    image: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
    description: "Breathable shirt with relaxed fit, perfect for warm weather."
  },
  {
    name: "Ceramic Table Lamp",
    category: "Home",
    price: 64.25,
    rating: 4.4,
    stock: 14,
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    description: "Modern lamp with warm ambient glow and matte ceramic base."
  },
  {
    name: "Sport Chronograph Watch",
    category: "Accessories",
    price: 149.99,
    rating: 4.8,
    stock: 8,
    image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=900&q=80",
    description: "Bold timepiece with stainless steel case and durable strap."
  },
  {
    name: "Soft Knit Hoodie",
    category: "Apparel",
    price: 59.99,
    rating: 4.2,
    stock: 22,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
    description: "Comfort hoodie with a clean silhouette and brushed inner lining."
  }
];

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5500,http://127.0.0.1:5500")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasValidSupabaseEnv =
  typeof supabaseUrl === "string" &&
  /^https?:\/\//i.test(supabaseUrl) &&
  typeof supabaseServiceRoleKey === "string" &&
  supabaseServiceRoleKey.length > 20 &&
  !supabaseServiceRoleKey.includes("your_supabase");
const supabase =
  hasValidSupabaseEnv
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

let hasSeededProducts = false;

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
app.use(express.json({ limit: "10mb" }));

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requireDb(_req, res, next) {
  if (!supabase) {
    return res.status(500).json({
      success: false,
      message:
        "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend environment."
    });
  }
  next();
}

function createAdminToken() {
  return jwt.sign({ email: ADMIN_EMAIL, role: "admin" }, ADMIN_JWT_SECRET, {
    expiresIn: "7d"
  });
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ success: false, message: "Admin token is required." });
  }

  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: "Invalid or expired admin token." });
  }
}

async function ensureSeedProducts() {
  if (!supabase || hasSeededProducts) return;

  const { data, error } = await supabase.from("products").select("id").limit(1);
  if (error) {
    throw new Error(
      `Unable to read products table. Ensure Supabase tables are created. Details: ${error.message}`
    );
  }

  if (!data || data.length === 0) {
    const { error: seedError } = await supabase.from("products").insert(defaultProducts);
    if (seedError) {
      throw new Error(`Unable to seed default products: ${seedError.message}`);
    }
  }

  hasSeededProducts = true;
}

async function markAbandonedSessions() {
  if (!supabase) return;
  const threshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  await supabase
    .from("cart_sessions")
    .update({ status: "abandoned", updated_at: new Date().toISOString() })
    .eq("status", "active")
    .lt("last_activity_at", threshold);
}

function sanitizeProductPayload(body = {}) {
  return {
    name: String(body.name || "").trim(),
    category: String(body.category || "").trim(),
    price: numberOrZero(body.price),
    stock: Math.max(0, Math.trunc(numberOrZero(body.stock))),
    description: String(body.description || "").trim(),
    image: String(body.image || "").trim(),
    rating: Math.min(5, Math.max(1, numberOrZero(body.rating || 4.5)))
  };
}

function sanitizeFileName(name = "upload") {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseDataUrl(dataUrl = "") {
  const match = String(dataUrl).match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    return null;
  }
  const mimeType = match[1];
  const base64Data = match[2];
  return { mimeType, base64Data };
}

function formatSessionPayload(body = {}) {
  return {
    session_id: String(body.sessionId || `session_${randomUUID()}`),
    customer_name: String(body.customerName || "").trim() || null,
    customer_email: String(body.customerEmail || "").trim().toLowerCase() || null,
    customer_phone: String(body.customerPhone || "").trim() || null,
    items: Array.isArray(body.items) ? body.items : [],
    total_amount: numberOrZero(body.totalAmount),
    status: ["active", "abandoned", "completed"].includes(body.status) ? body.status : "active",
    order_id: body.orderId ? String(body.orderId) : null,
    payment_session_id: body.paymentSessionId ? String(body.paymentSessionId) : null,
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function fetchCashfreeOrder(orderId) {
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
    const message = data?.message || data?.type || "Cashfree payment verification failed";
    const error = new Error(message);
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "API is running" });
});

app.post("/api/admin/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Invalid admin credentials." });
  }

  return res.json({
    success: true,
    token: createAdminToken(),
    admin: { email: ADMIN_EMAIL, role: "admin" }
  });
});

app.get("/api/admin/me", requireAdminAuth, (_req, res) => {
  res.json({ success: true, admin: { email: ADMIN_EMAIL, role: "admin" } });
});

app.get("/api/products", requireDb, async (_req, res) => {
  try {
    await ensureSeedProducts();

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return res.json({ success: true, products: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Unable to load products." });
  }
});

app.post("/api/admin/products", requireDb, requireAdminAuth, async (req, res) => {
  try {
    const product = sanitizeProductPayload(req.body);
    if (!product.name || !product.category || !product.image || !product.description || product.price <= 0) {
      return res.status(400).json({ success: false, message: "All product fields are required." });
    }

    const { data, error } = await supabase.from("products").insert(product).select("*").single();
    if (error) {
      throw new Error(error.message);
    }

    return res.status(201).json({ success: true, product: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Unable to create product." });
  }
});

app.post("/api/admin/upload-image", requireDb, requireAdminAuth, async (req, res) => {
  try {
    const { fileName, dataUrl } = req.body || {};
    const parsed = parseDataUrl(dataUrl);

    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: "Invalid image payload. Send a valid base64 data URL."
      });
    }

    const { mimeType, base64Data } = parsed;
    if (!/^image\//i.test(mimeType)) {
      return res.status(400).json({
        success: false,
        message: "Only image uploads are allowed."
      });
    }

    const fileBuffer = Buffer.from(base64Data, "base64");
    if (!fileBuffer.length) {
      return res.status(400).json({
        success: false,
        message: "Uploaded image is empty."
      });
    }

    const extensionFromMime = mimeType.split("/")[1] || "png";
    const safeName = sanitizeFileName(fileName || `product_${Date.now()}.${extensionFromMime}`);
    const storagePath = `products/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
        cacheControl: "3600"
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return res.status(201).json({
      success: true,
      imageUrl: publicData?.publicUrl || null,
      path: storagePath
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to upload image."
    });
  }
});

app.put("/api/admin/products/:id", requireDb, requireAdminAuth, async (req, res) => {
  try {
    const updates = sanitizeProductPayload(req.body);
    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    return res.json({ success: true, product: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Unable to update product." });
  }
});

app.delete("/api/admin/products/:id", requireDb, requireAdminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("products")
      .delete()
      .eq("id", req.params.id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    return res.json({ success: true, message: "Product deleted." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Unable to delete product." });
  }
});

app.post("/api/cart/session", requireDb, async (req, res) => {
  try {
    await markAbandonedSessions();
    const payload = formatSessionPayload(req.body);

    const { data, error } = await supabase
      .from("cart_sessions")
      .upsert(payload, { onConflict: "session_id" })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return res.status(201).json({ success: true, session: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Unable to track cart session." });
  }
});

app.put("/api/cart/session/:id", requireDb, async (req, res) => {
  try {
    const updates = formatSessionPayload(req.body);
    delete updates.session_id;

    const { data, error } = await supabase
      .from("cart_sessions")
      .update(updates)
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return res.status(404).json({ success: false, message: "Cart session not found." });
    }

    return res.json({ success: true, session: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Unable to update cart session." });
  }
});

app.get("/api/admin/carts", requireDb, requireAdminAuth, async (_req, res) => {
  try {
    await markAbandonedSessions();
    const { data, error } = await supabase
      .from("cart_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(error.message);
    }

    return res.json({ success: true, carts: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Unable to load carts." });
  }
});

app.get("/api/admin/abandoned-carts", requireDb, requireAdminAuth, async (_req, res) => {
  try {
    await markAbandonedSessions();
    const { data, error } = await supabase
      .from("cart_sessions")
      .select("*")
      .eq("status", "abandoned")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(error.message);
    }

    return res.json({ success: true, carts: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Unable to load abandoned carts." });
  }
});

app.post("/api/cashfree/create-order", requireDb, async (req, res) => {
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
      orderNote,
      cartSessionId,
      items,
      customerAddress,
      customerCity,
      customerZip
    } = req.body;

    if (!orderAmount || Number(orderAmount) <= 0) {
      return res.status(400).json({ success: false, message: "A valid order amount is required." });
    }

    await markAbandonedSessions();

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
        return_url: returnUrl || "https://webappdevitsolutions.github.io/Podsentra/checkout.html?order_id={order_id}"
      },
      order_note: orderNote || "Podsecntra order"
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

    if (cartSessionId) {
      await supabase
        .from("cart_sessions")
        .update({
          status: "active",
          order_id: data.order_id,
          payment_session_id: data.payment_session_id,
          customer_name: customerName || null,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
          items: Array.isArray(items) ? items : [],
          total_amount: numberOrZero(orderAmount),
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("session_id", String(cartSessionId));
    }

    return res.status(201).json({
      success: true,
      orderId: data.order_id,
      cfOrderId: data.cf_order_id,
      paymentSessionId: data.payment_session_id,
      orderStatus: data.order_status,
      cartSessionId: cartSessionId || null,
      customerSnapshot: {
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        customerCity,
        customerZip
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to create Cashfree order",
      error: error.message
    });
  }
});

app.post("/api/cashfree/verify-payment", requireDb, async (req, res) => {
  try {
    if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: "Cashfree credentials are missing. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY."
      });
    }

    const {
      orderId,
      cartSessionId,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerZip,
      items,
      amount
    } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required." });
    }

    const data = await fetchCashfreeOrder(orderId);
    const isPaid = data.order_status === "PAID";

    if (cartSessionId) {
      await supabase
        .from("cart_sessions")
        .update({
          status: isPaid ? "completed" : "active",
          order_id: data.order_id,
          payment_session_id: data.payment_session_id,
          customer_name: customerName || null,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
          items: Array.isArray(items) ? items : [],
          total_amount: numberOrZero(amount || data.order_amount),
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("session_id", String(cartSessionId));
    }

    if (isPaid) {
      await supabase.from("orders").upsert(
        {
          order_id: data.order_id,
          cf_order_id: data.cf_order_id,
          payment_session_id: data.payment_session_id,
          customer_name: customerName || null,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
          customer_address: customerAddress || null,
          customer_city: customerCity || null,
          customer_zip: customerZip || null,
          items: Array.isArray(items) ? items : [],
          amount: numberOrZero(amount || data.order_amount),
          payment_status: data.order_status,
          cart_session_id: null,
          updated_at: new Date().toISOString()
        },
        { onConflict: "order_id" }
      );
    }

    return res.json({
      success: isPaid,
      orderId: data.order_id,
      cfOrderId: data.cf_order_id,
      orderStatus: data.order_status,
      paymentSessionId: data.payment_session_id,
      orderAmount: data.order_amount
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to verify Cashfree payment",
      details: error.details || null
    });
  }
});

app.get("/api/admin/orders", requireDb, requireAdminAuth, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      throw new Error(error.message);
    }

    return res.json({ success: true, orders: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Unable to load orders." });
  }
});

app.get("/api/admin/dashboard", requireDb, requireAdminAuth, async (_req, res) => {
  try {
    await markAbandonedSessions();

    const [
      { count: productCount, error: productError },
      { count: successfulOrderCount, error: paidOrderError },
      { data: paidOrders, error: paidOrderDataError },
      { count: activeCartCount, error: activeCartError },
      { count: abandonedCartCount, error: abandonedCartError },
      { data: recentOrders, error: recentOrdersError },
      { data: recentAbandoned, error: recentAbandonedError }
    ] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "PAID"),
      supabase.from("orders").select("amount").eq("payment_status", "PAID"),
      supabase.from("cart_sessions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("cart_sessions").select("id", { count: "exact", head: true }).eq("status", "abandoned"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(10),
      supabase
        .from("cart_sessions")
        .select("*")
        .eq("status", "abandoned")
        .order("updated_at", { ascending: false })
        .limit(10)
    ]);

    const errors = [
      productError,
      paidOrderError,
      paidOrderDataError,
      activeCartError,
      abandonedCartError,
      recentOrdersError,
      recentAbandonedError
    ].filter(Boolean);

    if (errors.length) {
      throw new Error(errors[0].message || "Unable to load dashboard metrics.");
    }

    const totalRevenue = (paidOrders || []).reduce((sum, row) => sum + numberOrZero(row.amount), 0);

    return res.json({
      success: true,
      metrics: {
        totalProducts: productCount || 0,
        totalSuccessfulCheckouts: successfulOrderCount || 0,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        activeCarts: activeCartCount || 0,
        abandonedCarts: abandonedCartCount || 0
      },
      recentCheckouts: recentOrders || [],
      recentAbandonedCarts: recentAbandoned || []
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message || "Unable to load dashboard." });
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
  console.log(`Database connected: ${supabase ? "yes" : "no"}`);
});
