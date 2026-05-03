const API_BASE = "https://podsentra.onrender.com/api";
const ADMIN_TOKEN_KEY = "podsecntra_admin_token";
const CART_STORAGE_KEY = "podsecntra_cart_local";

const state = {
  token: localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  products: []
};

document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  renderCartCount();
  bindAdminUiEvents();

  if (state.token) {
    const ok = await verifyAdminSession();
    if (ok) {
      showAdminApp();
      await loadAllAdminData();
    } else {
      showLoginPanel();
    }
  } else {
    showLoginPanel();
  }
});

function setupNavigation() {
  const navLinks = document.getElementById("nav-links");
  const menuToggle = document.getElementById("menu-toggle");
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
  }

  const currentPage = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === currentPage) {
      link.classList.add("active");
    }
  });
}

function renderCartCount() {
  const badge = document.getElementById("cart-count");
  if (!badge) return;
  const cart = readJSON(CART_STORAGE_KEY, []);
  const count = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  badge.textContent = String(count);
}

function bindAdminUiEvents() {
  const loginForm = document.getElementById("admin-login-form");
  const logoutBtn = document.getElementById("admin-logout-btn");
  const productForm = document.getElementById("admin-product-form");
  const cancelBtn = document.getElementById("admin-cancel-btn");

  loginForm?.addEventListener("submit", handleAdminLogin);
  logoutBtn?.addEventListener("click", logoutAdmin);
  productForm?.addEventListener("submit", handleProductSave);
  cancelBtn?.addEventListener("click", resetProductForm);

  document.querySelectorAll(".admin-nav-btn").forEach((button) => {
    button.addEventListener("click", () => switchAdminView(button.dataset.adminView));
  });
}

function setLoginMessage(message, isError = false) {
  const el = document.getElementById("admin-login-message");
  if (!el) return;
  el.style.color = isError ? "#b91c1c" : "var(--primary-dark)";
  el.textContent = message;
}

function setGlobalMessage(message, isError = false) {
  const el = document.getElementById("admin-global-message");
  if (!el) return;
  el.style.color = isError ? "#b91c1c" : "var(--primary-dark)";
  el.textContent = message;
}

function showLoginPanel() {
  document.getElementById("admin-login-panel")?.classList.remove("hidden");
  document.getElementById("admin-app")?.classList.add("hidden");
}

function showAdminApp() {
  document.getElementById("admin-login-panel")?.classList.add("hidden");
  document.getElementById("admin-app")?.classList.remove("hidden");
  const navUser = document.getElementById("nav-user");
  if (navUser) navUser.textContent = "Admin";
}

function logoutAdmin() {
  state.token = "";
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  showLoginPanel();
  setGlobalMessage("");
  setLoginMessage("Logged out.");
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;
  const submitBtn = document.getElementById("admin-login-btn");

  setLoading(submitBtn, true, "Signing in...");
  setLoginMessage("");

  try {
    const response = await apiFetch("/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    state.token = response.token;
    localStorage.setItem(ADMIN_TOKEN_KEY, state.token);

    showAdminApp();
    await loadAllAdminData();
    setGlobalMessage("Welcome to Podsecntra admin dashboard.");
  } catch (error) {
    setLoginMessage(error.message, true);
  } finally {
    setLoading(submitBtn, false, "Login");
  }
}

async function verifyAdminSession() {
  try {
    await apiFetchAdmin("/admin/me");
    return true;
  } catch (_error) {
    state.token = "";
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    return false;
  }
}

async function loadAllAdminData() {
  await Promise.all([
    loadDashboardMetrics(),
    loadProducts(),
    loadOrders(),
    loadActiveCarts(),
    loadAbandonedCarts()
  ]);
}

function switchAdminView(viewName) {
  document.querySelectorAll(".admin-view").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== viewName);
  });

  document.querySelectorAll(".admin-nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminView === viewName);
  });
}

async function loadDashboardMetrics() {
  try {
    const response = await apiFetchAdmin("/admin/dashboard");
    const metrics = response.metrics || {};

    setText("metric-products", metrics.totalProducts || 0);
    setText("metric-checkouts", metrics.totalSuccessfulCheckouts || 0);
    setText("metric-revenue", `Rs ${Number(metrics.totalRevenue || 0).toFixed(2)}`);
    setText("metric-active-carts", metrics.activeCarts || 0);
    setText("metric-abandoned-carts", metrics.abandonedCarts || 0);

    renderOverviewOrders(response.recentCheckouts || []);
    renderOverviewAbandoned(response.recentAbandonedCarts || []);
  } catch (error) {
    setGlobalMessage(error.message, true);
  }
}

async function loadProducts() {
  try {
    const response = await apiFetch("/products");
    state.products = response.products || [];
    renderProductsList();
  } catch (error) {
    setGlobalMessage(error.message, true);
  }
}

async function handleProductSave(event) {
  event.preventDefault();

  const id = document.getElementById("admin-product-id").value;
  const payload = {
    name: document.getElementById("admin-name").value.trim(),
    category: document.getElementById("admin-category").value.trim(),
    price: Number(document.getElementById("admin-price").value),
    stock: Number(document.getElementById("admin-stock").value),
    rating: Number(document.getElementById("admin-rating").value),
    image: document.getElementById("admin-image").value.trim(),
    description: document.getElementById("admin-description").value.trim()
  };

  const saveBtn = document.getElementById("admin-save-btn");
  setLoading(saveBtn, true, id ? "Updating..." : "Creating...");

  try {
    if (id) {
      await apiFetchAdmin(`/admin/products/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setGlobalMessage("Product updated successfully.");
    } else {
      await apiFetchAdmin("/admin/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setGlobalMessage("Product created successfully.");
    }

    resetProductForm();
    await Promise.all([loadProducts(), loadDashboardMetrics()]);
  } catch (error) {
    setGlobalMessage(error.message, true);
  } finally {
    setLoading(saveBtn, false, "Save Product");
  }
}

function renderProductsList() {
  const mount = document.getElementById("admin-products-list");
  if (!mount) return;

  if (!state.products.length) {
    mount.innerHTML = '<p class="empty-state">No products found.</p>';
    return;
  }

  mount.innerHTML = state.products
    .map(
      (product) => `
      <article class="admin-item">
        <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}">
        <div>
          <strong>${escapeHTML(product.name)}</strong>
          <p class="soft-text">${escapeHTML(product.category)} | Rs ${Number(product.price).toFixed(2)} | Stock: ${Number(product.stock)}</p>
        </div>
        <div class="btn-row">
          <button class="btn btn-light btn-small" data-product-edit="${escapeHTML(product.id)}" type="button">Edit</button>
          <button class="btn btn-danger btn-small" data-product-delete="${escapeHTML(product.id)}" type="button">Delete</button>
        </div>
      </article>
    `
    )
    .join("");

  mount.querySelectorAll("[data-product-edit]").forEach((button) => {
    button.addEventListener("click", () => populateProductForm(button.dataset.productEdit));
  });

  mount.querySelectorAll("[data-product-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this product?")) return;
      try {
        await apiFetchAdmin(`/admin/products/${encodeURIComponent(button.dataset.productDelete)}`, {
          method: "DELETE"
        });
        setGlobalMessage("Product deleted.");
        await Promise.all([loadProducts(), loadDashboardMetrics()]);
      } catch (error) {
        setGlobalMessage(error.message, true);
      }
    });
  });
}

function populateProductForm(productId) {
  const product = state.products.find((item) => String(item.id) === String(productId));
  if (!product) return;

  document.getElementById("admin-product-id").value = product.id;
  document.getElementById("admin-name").value = product.name;
  document.getElementById("admin-category").value = product.category;
  document.getElementById("admin-price").value = product.price;
  document.getElementById("admin-stock").value = product.stock;
  document.getElementById("admin-rating").value = product.rating;
  document.getElementById("admin-image").value = product.image;
  document.getElementById("admin-description").value = product.description;
  document.getElementById("admin-form-title").textContent = "Edit Product";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetProductForm() {
  document.getElementById("admin-product-form")?.reset();
  const idInput = document.getElementById("admin-product-id");
  if (idInput) idInput.value = "";
  const title = document.getElementById("admin-form-title");
  if (title) title.textContent = "Add Product";
}

async function loadOrders() {
  try {
    const response = await apiFetchAdmin("/admin/orders");
    const orders = response.orders || [];
    const mount = document.getElementById("admin-orders-list");

    if (!mount) return;
    if (!orders.length) {
      mount.innerHTML = '<p class="empty-state">No checkout records yet.</p>';
      return;
    }

    mount.innerHTML = orders
      .map(
        (order) => `
        <article class="record-item">
          <p><strong>Order:</strong> ${escapeHTML(order.order_id)}</p>
          <p><strong>Status:</strong> ${escapeHTML(order.payment_status)}</p>
          <p><strong>Amount:</strong> Rs ${Number(order.amount || 0).toFixed(2)}</p>
          <p><strong>Customer:</strong> ${escapeHTML(order.customer_name || "Guest")} (${escapeHTML(order.customer_email || "n/a")})</p>
          <p class="soft-text">${formatDate(order.created_at)}</p>
        </article>
      `
      )
      .join("");
  } catch (error) {
    setGlobalMessage(error.message, true);
  }
}

async function loadActiveCarts() {
  try {
    const response = await apiFetchAdmin("/admin/carts");
    const carts = (response.carts || []).filter((item) => item.status === "active");
    renderCartList("admin-carts-list", carts, "No active carts right now.");
  } catch (error) {
    setGlobalMessage(error.message, true);
  }
}

async function loadAbandonedCarts() {
  try {
    const response = await apiFetchAdmin("/admin/abandoned-carts");
    renderCartList("admin-abandoned-list", response.carts || [], "No abandoned carts.");
  } catch (error) {
    setGlobalMessage(error.message, true);
  }
}

function renderCartList(elementId, carts, emptyText) {
  const mount = document.getElementById(elementId);
  if (!mount) return;

  if (!carts.length) {
    mount.innerHTML = `<p class="empty-state">${escapeHTML(emptyText)}</p>`;
    return;
  }

  mount.innerHTML = carts
    .map(
      (cart) => `
      <article class="record-item">
        <p><strong>Session:</strong> ${escapeHTML(cart.session_id)}</p>
        <p><strong>Status:</strong> ${escapeHTML(cart.status)}</p>
        <p><strong>Total:</strong> Rs ${Number(cart.total_amount || 0).toFixed(2)}</p>
        <p><strong>Customer:</strong> ${escapeHTML(cart.customer_name || "Guest")} (${escapeHTML(cart.customer_email || "n/a")})</p>
        <p><strong>Items:</strong> ${Array.isArray(cart.items) ? cart.items.length : 0}</p>
        <p class="soft-text">Updated: ${formatDate(cart.updated_at || cart.created_at)}</p>
      </article>
    `
    )
    .join("");
}

function renderOverviewOrders(orders) {
  const mount = document.getElementById("overview-recent-orders");
  if (!mount) return;

  if (!orders.length) {
    mount.innerHTML = '<p class="empty-state">No recent checkout sessions.</p>';
    return;
  }

  mount.innerHTML = orders
    .map(
      (order) => `
      <article class="record-item compact">
        <p><strong>${escapeHTML(order.order_id)}</strong> • ${escapeHTML(order.payment_status)}</p>
        <p>Rs ${Number(order.amount || 0).toFixed(2)}</p>
      </article>
    `
    )
    .join("");
}

function renderOverviewAbandoned(carts) {
  const mount = document.getElementById("overview-recent-abandoned");
  if (!mount) return;

  if (!carts.length) {
    mount.innerHTML = '<p class="empty-state">No recent abandoned sessions.</p>';
    return;
  }

  mount.innerHTML = carts
    .map(
      (cart) => `
      <article class="record-item compact">
        <p><strong>${escapeHTML(cart.session_id)}</strong> • ${escapeHTML(cart.status)}</p>
        <p>Rs ${Number(cart.total_amount || 0).toFixed(2)}</p>
      </article>
    `
    )
    .join("");
}

async function apiFetchAdmin(path, options = {}) {
  return apiFetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.token}`,
      ...(options.headers || {})
    }
  });
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function setLoading(button, isLoading, loadingText) {
  if (!button) return;
  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : button.dataset.defaultText;
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
