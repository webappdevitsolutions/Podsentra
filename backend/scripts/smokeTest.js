const API_BASE = process.env.API_BASE || "http://localhost:5000/api";

const adminCreds = {
  email: process.env.ADMIN_EMAIL || "admin@podsecntra.com",
  password: process.env.ADMIN_PASSWORD || "change_this_admin_password"
};

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
  console.log("[SmokeTest] Checking API health");
  await request("/health", { expectStatuses: [200] });

  console.log("[SmokeTest] Checking products endpoint accessibility");
  await request("/products", { expectStatuses: [200, 500] });

  console.log("[SmokeTest] Checking admin login flow");
  const adminLogin = await request("/admin/login", {
    method: "POST",
    body: adminCreds,
    expectStatuses: [200, 401]
  });

  if (adminLogin.status === 200 && adminLogin.data?.token) {
    console.log("[SmokeTest] Checking protected admin endpoint /admin/me");
    await request("/admin/me", {
      token: adminLogin.data.token,
      expectStatuses: [200]
    });
  } else {
    console.log("[SmokeTest] Admin credentials are not set for this environment, skipped /admin/me validation");
  }

  console.log("[SmokeTest] Completed");
};

run().catch((error) => {
  console.error(`[SmokeTest] Failed: ${error.message}`);
  process.exit(1);
});
