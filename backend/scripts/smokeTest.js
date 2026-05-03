const API_BASE = process.env.API_BASE || "http://localhost:5000/api";

const randomSuffix = Date.now().toString().slice(-6);
const testUser = {
  name: `User${randomSuffix}`,
  email: `user${randomSuffix}@example.com`,
  password: "userpass123"
};

const adminCreds = {
  email: process.env.ADMIN_EMAIL || "admin@example.com",
  password: process.env.ADMIN_PASSWORD || "admin12345"
};

const shippingAddress = {
  fullName: "Test Buyer",
  email: testUser.email,
  address: "123 Test Street",
  city: "Kolkata",
  zip: "700001"
};

const log = (msg) => console.log(`[SmokeTest] ${msg}`);

const request = async (path, { method = "GET", body, token, expectStatuses = [200] } = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const data = await response.json().catch(() => ({}));
  if (!expectStatuses.includes(response.status)) {
    throw new Error(
      `${method} ${path} failed with ${response.status}: ${data.message || "Unknown error"}`
    );
  }

  return { status: response.status, data };
};

const run = async () => {
  log("Checking /api/health");
  await request("/health", { expectStatuses: [200] });

  log("Verifying core route mounts");
  await request("/auth/register", {
    method: "POST",
    body: { name: "", email: "bad", password: "123" },
    expectStatuses: [400]
  });
  await request("/auth/login", {
    method: "POST",
    body: { email: "bad", password: "123" },
    expectStatuses: [400, 401]
  });
  await request("/products", { expectStatuses: [200] });
  await request("/orders", {
    method: "POST",
    body: {},
    expectStatuses: [401]
  });
  await request("/upload", {
    method: "POST",
    expectStatuses: [401]
  });

  log("Registering user");
  const reg = await request("/auth/register", {
    method: "POST",
    body: testUser,
    expectStatuses: [201]
  });
  const userToken = reg.data.token;

  log("Logging in user");
  const login = await request("/auth/login", {
    method: "POST",
    body: { email: testUser.email, password: testUser.password },
    expectStatuses: [200]
  });
  const loginToken = login.data.token;

  if (!userToken || !loginToken) {
    throw new Error("User auth token missing in register/login flow");
  }

  log("Logging in admin");
  const admin = await request("/auth/admin/login", {
    method: "POST",
    body: adminCreds,
    expectStatuses: [200]
  });
  const adminToken = admin.data.token;

  log("Admin adding product");
  const addProduct = await request("/products", {
    method: "POST",
    token: adminToken,
    body: {
      name: `Smoke Product ${randomSuffix}`,
      price: 99.99,
      description: "Smoke test product",
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
      category: "Testing",
      stock: 5,
      rating: 4.2
    },
    expectStatuses: [201]
  });
  const product = addProduct.data.product;

  log("Checking product appears in listing");
  const allProducts = await request("/products", { expectStatuses: [200] });
  const exists = (allProducts.data.products || []).some((p) => p._id === product._id);
  if (!exists) {
    throw new Error("Created product was not found in /api/products response");
  }

  log("Creating COD order (cart/checkout flow API validation)");
  const orderResp = await request("/orders", {
    method: "POST",
    token: loginToken,
    body: {
      items: [{ productId: product._id, quantity: 1 }],
      shippingAddress,
      paymentMethod: "cod"
    },
    expectStatuses: [201]
  });
  const order = orderResp.data.order;

  log("Payment verify placeholder check");
  await request("/orders/verify-payment", {
    method: "POST",
    token: loginToken,
    body: {
      orderId: order._id,
      razorpayOrderId: "order_placeholder",
      razorpayPaymentId: "payment_placeholder",
      razorpaySignature: "invalid_signature"
    },
    expectStatuses: [400, 503]
  });

  log("Upload route guard check");
  await request("/upload", {
    method: "POST",
    token: adminToken,
    expectStatuses: [400, 503]
  });

  log("Smoke test completed successfully");
};

run().catch((error) => {
  console.error(`[SmokeTest] Failed: ${error.message}`);
  process.exit(1);
});
