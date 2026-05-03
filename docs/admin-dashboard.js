const API_BASE = "https://podsentra.onrender.com/api";
const ADMIN_TOKEN_KEY = "podsecntra_admin_token";
const CART_STORAGE_KEY = "podsecntra_cart_local";

const state = {
  token: localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  products: [],
  orders: [],
  activeCarts: [],
  abandonedCarts: [],
  dashboard: null,
  productFilters: {
    search: "",
    category: "all",
    page: 1,
    pageSize: 6
  },
  orderFilters: {
    status: "all",
    from: "",
    to: ""
  },
  loadingCount: 0
};

document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  renderCartCount();
  bindUiEvents();

  if (!state.token) {
    showLoginPanel();
    setLoginMessage("Please login to access admin routes.");
    return;
  }

  const authorized = await verifyAdminSession();
  if (!authorized) {
    showLoginPanel();
    setLoginMessage("Session expired. Please login again.", true);
    return;
  }

  showAdminApp();
  await refreshAll();
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

function bindUiEvents() {
  document.getElementById("admin-login-form")?.addEventListener("submit", handleLogin);
  document.getElementById("admin-logout-btn")?.addEventListener("click", logoutAdmin);

  document.querySelectorAll(".admin-nav-btn").forEach((button) => {
    button.addEventListener("click", () => switchAdminView(button.dataset.adminView));
  });

  document.getElementById("admin-product-form")?.addEventListener("submit", handleProductSave);
  document.getElementById("admin-cancel-btn")?.addEventListener("click", resetProductForm);
  document.getElementById("admin-image-upload-btn")?.addEventListener("click", handleImageUpload);
  document.getElementById("admin-image-file")?.addEventListener("change", handleImagePreview);

  document.getElementById("product-search")?.addEventListener("input", (event) => {
    state.productFilters.search = event.target.value.trim().toLowerCase();
    state.productFilters.page = 1;
    renderProducts();
  });

  document.getElementById("product-category-filter")?.addEventListener("change", (event) => {
    state.productFilters.category = event.target.value;
    state.productFilters.page = 1;
    renderProducts();
  });

  document.getElementById("orders-status-filter")?.addEventListener("change", (event) => {
    state.orderFilters.status = event.target.value;
    renderOrders();
  });

  document.getElementById("orders-date-from")?.addEventListener("change", (event) => {
    state.orderFilters.from = event.target.value;
    renderOrders();
  });

  document.getElementById("orders-date-to")?.addEventListener("change", (event) => {
    state.orderFilters.to = event.target.value;
    renderOrders();
  });

  document.getElementById("order-modal-close")?.addEventListener("click", closeOrderModal);
  document.getElementById("order-details-modal")?.addEventListener("click", (event) => {
    if (event.target.id === "order-details-modal") {
      closeOrderModal();
    }
  });
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

function switchAdminView(viewName) {
  document.querySelectorAll(".admin-view").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== viewName);
  });

  document.querySelectorAll(".admin-nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminView === viewName);
  });
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;
  const loginBtn = document.getElementById("admin-login-btn");

  setLoading(loginBtn, true, "Signing in...");
  setLoginMessage("");

  try {
    const response = await apiFetch("/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    state.token = response.token;
    localStorage.setItem(ADMIN_TOKEN_KEY, state.token);
    showAdminApp();
    showToast("Login successful", "success");
    await refreshAll();
  } catch (error) {
    setLoginMessage(error.message, true);
    showToast(error.message, "error");
  } finally {
    setLoading(loginBtn, false, "Login");
  }
}

function logoutAdmin() {
  state.token = "";
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  showLoginPanel();
  setLoginMessage("Logged out.");
  showToast("Admin session ended", "success");
}

async function verifyAdminSession() {
  try {
    await apiFetchAdmin("/admin/me", { suppressUnauthorizedRedirect: true });
    return true;
  } catch (_error) {
    state.token = "";
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    return false;
  }
}

async function refreshAll() {
  await Promise.all([
    loadDashboard(),
    loadProducts(),
    loadOrders(),
    loadActiveCarts(),
    loadAbandonedCarts()
  ]);
}

async function loadDashboard() {
  try {
    const response = await apiFetchAdmin("/admin/dashboard");
    state.dashboard = response;

    const metrics = response.metrics || {};
    setText("metric-revenue", `Rs ${Number(metrics.totalRevenue || 0).toFixed(2)}`);
    setText("metric-orders", metrics.totalSuccessfulCheckouts || 0);
    setText("metric-active-carts", metrics.activeCarts || 0);
    setText("metric-abandoned-carts", metrics.abandonedCarts || 0);

    renderOverviewOrders(response.recentCheckouts || []);
    renderOverviewAbandoned(response.recentAbandonedCarts || []);
    renderCharts();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderCharts() {
  const recentOrders = state.dashboard?.recentCheckouts || [];
  const recentAbandoned = state.dashboard?.recentAbandonedCarts || [];

  const revenuePoints = aggregateByDate(recentOrders, (item) => Number(item.amount || 0));
  const abandonPoints = aggregateByDate(recentAbandoned, () => 1);

  drawBarChart("revenue-chart", {
    labels: revenuePoints.labels,
    values: revenuePoints.values,
    color: "#0f766e",
    valuePrefix: "Rs "
  });

  drawDualBarChart("cart-chart", {
    labels: ["Active", "Abandoned"],
    valuesA: [Number(state.dashboard?.metrics?.activeCarts || 0)],
    valuesB: [Number(state.dashboard?.metrics?.abandonedCarts || 0)],
    colorA: "#0f766e",
    colorB: "#f59e0b"
  });
}

function aggregateByDate(rows, valueFn) {
  const map = new Map();
  rows.forEach((row) => {
    const date = new Date(row.created_at || row.updated_at || Date.now());
    const key = Number.isNaN(date.getTime()) ? "Unknown" : date.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + Number(valueFn(row) || 0));
  });

  const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-7);
  return {
    labels: entries.length ? entries.map(([d]) => d.slice(5)) : ["No data"],
    values: entries.length ? entries.map(([, v]) => Number(v.toFixed(2))) : [0]
  };
}

function drawBarChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const labels = config.labels || [];
  const values = config.values || [];
  const max = Math.max(...values, 1);
  const chartHeight = height - 40;
  const barWidth = Math.max(20, Math.floor((width - 30) / Math.max(labels.length, 1)) - 10);

  values.forEach((value, index) => {
    const x = 20 + index * (barWidth + 10);
    const barHeight = Math.round((value / max) * chartHeight);
    const y = height - 20 - barHeight;

    ctx.fillStyle = config.color || "#0f766e";
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#5d6d68";
    ctx.font = "11px Manrope";
    ctx.fillText(labels[index] || "", x, height - 6);

    ctx.fillStyle = "#19211f";
    const valueLabel = `${config.valuePrefix || ""}${value}`;
    ctx.fillText(valueLabel, x, Math.max(10, y - 5));
  });
}

function drawDualBarChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const active = Number(config.valuesA[0] || 0);
  const abandoned = Number(config.valuesB[0] || 0);
  const max = Math.max(active, abandoned, 1);
  const baseY = height - 30;
  const barMaxHeight = height - 60;

  const bars = [
    { label: "Active", value: active, color: config.colorA || "#0f766e", x: width * 0.25 },
    { label: "Abandoned", value: abandoned, color: config.colorB || "#f59e0b", x: width * 0.6 }
  ];

  bars.forEach((bar) => {
    const h = (bar.value / max) * barMaxHeight;
    const y = baseY - h;
    const w = 80;

    ctx.fillStyle = bar.color;
    ctx.fillRect(bar.x, y, w, h);

    ctx.fillStyle = "#19211f";
    ctx.font = "12px Manrope";
    ctx.fillText(String(bar.value), bar.x + 28, Math.max(14, y - 6));

    ctx.fillStyle = "#5d6d68";
    ctx.fillText(bar.label, bar.x + 16, baseY + 16);
  });
}

function renderOverviewOrders(orders) {
  const mount = document.getElementById("overview-recent-orders");
  if (!mount) return;

  if (!orders.length) {
    mount.innerHTML = '<p class="empty-state">No recent checkout sessions.</p>';
    return;
  }

  mount.innerHTML = orders
    .slice(0, 6)
    .map(
      (order) => `
      <article class="record-item compact">
        <p><strong>${escapeHTML(order.order_id)}</strong> • ${statusChip(order.payment_status)}</p>
        <p>Rs ${Number(order.amount || 0).toFixed(2)} • ${formatDate(order.created_at)}</p>
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
    .slice(0, 6)
    .map(
      (cart) => `
      <article class="record-item compact">
        <p><strong>${escapeHTML(cart.session_id)}</strong> • <span class="badge badge-warn">Abandoned</span></p>
        <p>Items: ${Array.isArray(cart.items) ? cart.items.length : 0} • ${formatDate(cart.updated_at)}</p>
      </article>
    `
    )
    .join("");
}

async function loadProducts() {
  try {
    const response = await apiFetch("/products");
    state.products = response.products || [];
    renderProductFilters();
    renderProducts();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderProductFilters() {
  const filter = document.getElementById("product-category-filter");
  if (!filter) return;
  const categories = [...new Set(state.products.map((product) => product.category).filter(Boolean))];
  filter.innerHTML = '<option value="all">All Categories</option>';
  filter.innerHTML += categories
    .map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`)
    .join("");

  if (state.productFilters.category !== "all" && !categories.includes(state.productFilters.category)) {
    state.productFilters.category = "all";
  }
  filter.value = state.productFilters.category;
}

function getFilteredProducts() {
  const query = state.productFilters.search;
  const category = state.productFilters.category;

  return state.products.filter((product) => {
    const matchesQuery =
      !query ||
      String(product.name || "").toLowerCase().includes(query) ||
      String(product.description || "").toLowerCase().includes(query);
    const matchesCategory = category === "all" || product.category === category;
    return matchesQuery && matchesCategory;
  });
}

function renderProducts() {
  const mount = document.getElementById("admin-products-list");
  const pagination = document.getElementById("products-pagination");
  if (!mount || !pagination) return;

  const filtered = getFilteredProducts();
  if (!filtered.length) {
    mount.innerHTML = '<p class="empty-state">No products match your filters.</p>';
    pagination.innerHTML = "";
    return;
  }

  const pageSize = state.productFilters.pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.productFilters.page = Math.min(state.productFilters.page, totalPages);

  const start = (state.productFilters.page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  mount.innerHTML = pageItems
    .map(
      (product) => `
      <article class="admin-item ${String(product.id) === String(document.getElementById("admin-product-id")?.value || "") ? "admin-item-active" : ""}">
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
        showToast("Product deleted", "success");
        await Promise.all([loadProducts(), loadDashboard()]);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pagination = document.getElementById("products-pagination");
  if (!pagination) return;

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  const current = state.productFilters.page;
  pagination.innerHTML = `
    <button class="btn btn-light btn-small" type="button" id="products-prev" ${current <= 1 ? "disabled" : ""}>Prev</button>
    <span class="soft-text">Page ${current} of ${totalPages}</span>
    <button class="btn btn-light btn-small" type="button" id="products-next" ${current >= totalPages ? "disabled" : ""}>Next</button>
  `;

  document.getElementById("products-prev")?.addEventListener("click", () => {
    state.productFilters.page = Math.max(1, state.productFilters.page - 1);
    renderProducts();
  });

  document.getElementById("products-next")?.addEventListener("click", () => {
    state.productFilters.page = Math.min(totalPages, state.productFilters.page + 1);
    renderProducts();
  });
}

function handleImagePreview(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  previewImage(file);
}

function previewImage(file) {
  const previewWrap = document.getElementById("admin-image-preview-wrap");
  const preview = document.getElementById("admin-image-preview");
  if (!previewWrap || !preview) return;

  const reader = new FileReader();
  reader.onload = () => {
    preview.src = String(reader.result || "");
    previewWrap.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

async function handleImageUpload() {
  const fileInput = document.getElementById("admin-image-file");
  const status = document.getElementById("admin-image-upload-status");
  const imageUrlInput = document.getElementById("admin-image");
  const uploadBtn = document.getElementById("admin-image-upload-btn");

  const file = fileInput?.files?.[0];
  if (!file) {
    showToast("Please select an image first", "error");
    return;
  }

  setLoading(uploadBtn, true, "Uploading...");
  if (status) status.textContent = "Uploading image...";

  try {
    const dataUrl = await fileToDataUrl(file);
    const response = await apiFetchAdmin("/admin/upload-image", {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        dataUrl
      })
    });

    imageUrlInput.value = response.imageUrl || "";
    if (status) status.textContent = "Upload successful.";
    showToast("Image uploaded successfully", "success");
  } catch (error) {
    if (status) status.textContent = "Upload failed.";
    showToast(error.message, "error");
  } finally {
    setLoading(uploadBtn, false, "Upload Image");
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

function populateProductForm(productId) {
  const product = state.products.find((item) => String(item.id) === String(productId));
  if (!product) return;

  document.getElementById("admin-product-id").value = product.id;
  document.getElementById("admin-name").value = product.name || "";
  document.getElementById("admin-category").value = product.category || "";
  document.getElementById("admin-price").value = product.price || 0;
  document.getElementById("admin-stock").value = product.stock || 0;
  document.getElementById("admin-rating").value = product.rating || 4.5;
  document.getElementById("admin-image").value = product.image || "";
  document.getElementById("admin-description").value = product.description || "";
  document.getElementById("admin-form-title").textContent = "Edit Product";

  const previewWrap = document.getElementById("admin-image-preview-wrap");
  const preview = document.getElementById("admin-image-preview");
  if (previewWrap && preview && product.image) {
    preview.src = product.image;
    previewWrap.classList.remove("hidden");
  }

  renderProducts();
  switchAdminView("products");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetProductForm() {
  document.getElementById("admin-product-form")?.reset();
  document.getElementById("admin-product-id").value = "";
  document.getElementById("admin-form-title").textContent = "Add Product";
  const previewWrap = document.getElementById("admin-image-preview-wrap");
  if (previewWrap) previewWrap.classList.add("hidden");
  const status = document.getElementById("admin-image-upload-status");
  if (status) status.textContent = "";
  renderProducts();
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
      showToast("Product updated", "success");
    } else {
      await apiFetchAdmin("/admin/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showToast("Product created", "success");
    }

    resetProductForm();
    await Promise.all([loadProducts(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(saveBtn, false, "Save Product");
  }
}

async function loadOrders() {
  try {
    const response = await apiFetchAdmin("/admin/orders");
    state.orders = response.orders || [];
    renderOrders();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function getFilteredOrders() {
  const status = state.orderFilters.status;
  const from = state.orderFilters.from ? new Date(`${state.orderFilters.from}T00:00:00`).getTime() : null;
  const to = state.orderFilters.to ? new Date(`${state.orderFilters.to}T23:59:59`).getTime() : null;

  return state.orders.filter((order) => {
    const orderStatus = String(order.payment_status || "").toUpperCase();
    const time = new Date(order.created_at || Date.now()).getTime();

    const statusOk = status === "all" || orderStatus === status;
    const fromOk = from === null || time >= from;
    const toOk = to === null || time <= to;

    return statusOk && fromOk && toOk;
  });
}

function renderOrders() {
  const tbody = document.getElementById("admin-orders-tbody");
  const empty = document.getElementById("orders-empty");
  if (!tbody || !empty) return;

  const filtered = getFilteredOrders();
  empty.classList.toggle("hidden", filtered.length > 0);

  tbody.innerHTML = filtered
    .map(
      (order) => `
      <tr>
        <td>${escapeHTML(order.order_id || "-")}</td>
        <td>${escapeHTML(order.customer_email || "-")}</td>
        <td>Rs ${Number(order.amount || 0).toFixed(2)}</td>
        <td>${statusChip(order.payment_status)}</td>
        <td>${formatDate(order.created_at)}</td>
        <td><button class="btn btn-light btn-small" data-order-view="${escapeHTML(order.order_id || "")}" type="button">View Details</button></td>
      </tr>
    `
    )
    .join("");

  tbody.querySelectorAll("[data-order-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => String(item.order_id) === String(button.dataset.orderView));
      if (order) openOrderModal(order);
    });
  });
}

function openOrderModal(order) {
  const modal = document.getElementById("order-details-modal");
  const content = document.getElementById("order-details-content");
  if (!modal || !content) return;

  const items = Array.isArray(order.items) ? order.items : [];

  content.innerHTML = `
    <div class="record-item">
      <p><strong>Order ID:</strong> ${escapeHTML(order.order_id || "-")}</p>
      <p><strong>Cashfree Order:</strong> ${escapeHTML(order.cf_order_id || "-")}</p>
      <p><strong>Status:</strong> ${statusChip(order.payment_status)}</p>
      <p><strong>Amount:</strong> Rs ${Number(order.amount || 0).toFixed(2)}</p>
      <p><strong>Customer:</strong> ${escapeHTML(order.customer_name || "Guest")}</p>
      <p><strong>Email:</strong> ${escapeHTML(order.customer_email || "-")}</p>
      <p><strong>Phone:</strong> ${escapeHTML(order.customer_phone || "-")}</p>
      <p><strong>Address:</strong> ${escapeHTML(order.customer_address || "-")}</p>
      <p><strong>City:</strong> ${escapeHTML(order.customer_city || "-")}</p>
      <p><strong>ZIP:</strong> ${escapeHTML(order.customer_zip || "-")}</p>
      <p><strong>Date:</strong> ${formatDate(order.created_at)}</p>
    </div>
    <h3>Items</h3>
    <div class="table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Qty</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
              <tr>
                <td>${escapeHTML(item.name || item.productId || "-")}</td>
                <td>${Number(item.quantity || 0)}</td>
                <td>Rs ${Number(item.price || item.lineTotal || 0).toFixed(2)}</td>
              </tr>
            `
            )
            .join("") || '<tr><td colspan="3">No items recorded</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  modal.classList.remove("hidden");
}

function closeOrderModal() {
  document.getElementById("order-details-modal")?.classList.add("hidden");
}

async function loadActiveCarts() {
  try {
    const response = await apiFetchAdmin("/admin/carts");
    state.activeCarts = (response.carts || []).filter((cart) => cart.status === "active");
    renderActiveCarts();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderActiveCarts() {
  const tbody = document.getElementById("admin-carts-tbody");
  const empty = document.getElementById("active-carts-empty");
  if (!tbody || !empty) return;

  empty.classList.toggle("hidden", state.activeCarts.length > 0);
  tbody.innerHTML = state.activeCarts
    .map(
      (cart) => `
      <tr>
        <td>${escapeHTML(cart.session_id || "-")}</td>
        <td>${Array.isArray(cart.items) ? cart.items.length : 0}</td>
        <td>Rs ${Number(cart.total_amount || 0).toFixed(2)}</td>
        <td>${formatDate(cart.last_activity_at || cart.updated_at || cart.created_at)}</td>
        <td><span class="badge badge-success">Active</span></td>
      </tr>
    `
    )
    .join("");
}

async function loadAbandonedCarts() {
  try {
    const response = await apiFetchAdmin("/admin/abandoned-carts");
    state.abandonedCarts = response.carts || [];
    renderAbandonedCarts();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderAbandonedCarts() {
  const tbody = document.getElementById("admin-abandoned-tbody");
  const empty = document.getElementById("abandoned-carts-empty");
  if (!tbody || !empty) return;

  empty.classList.toggle("hidden", state.abandonedCarts.length > 0);
  tbody.innerHTML = state.abandonedCarts
    .map(
      (cart) => {
        const items = Array.isArray(cart.items) ? cart.items : [];
        const productNames = items.slice(0, 3).map((item) => item.name || item.productId).join(", ");
        return `
        <tr>
          <td>${escapeHTML(cart.session_id || "-")}</td>
          <td>${escapeHTML(productNames || "No items")}${items.length > 3 ? ` +${items.length - 3} more` : ""}</td>
          <td>Rs ${Number(cart.total_amount || 0).toFixed(2)}</td>
          <td>${formatDate(cart.last_activity_at || cart.updated_at || cart.created_at)}</td>
          <td><span class="badge badge-warn">Abandoned</span></td>
        </tr>
      `;
      }
    )
    .join("");
}

async function apiFetchAdmin(path, options = {}) {
  return apiFetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.token}`,
      ...(options.headers || {})
    },
    suppressUnauthorizedRedirect: options.suppressUnauthorizedRedirect || false
  });
}

async function apiFetch(path, options = {}) {
  const { suppressUnauthorizedRedirect = false, ...restOptions } = options;
  startLoading();

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(restOptions.headers || {})
      },
      ...restOptions
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && !suppressUnauthorizedRedirect) {
        state.token = "";
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        showLoginPanel();
        setLoginMessage("Session expired. Please login again.", true);
      }
      throw new Error(payload.message || "Request failed");
    }

    return payload;
  } finally {
    stopLoading();
  }
}

function startLoading() {
  state.loadingCount += 1;
  document.getElementById("loading-overlay")?.classList.remove("hidden");
}

function stopLoading() {
  state.loadingCount = Math.max(0, state.loadingCount - 1);
  if (state.loadingCount === 0) {
    document.getElementById("loading-overlay")?.classList.add("hidden");
  }
}

function showToast(message, type = "success") {
  const root = document.getElementById("toast-root");
  if (!root || !message) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  root.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-show"));
  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

function statusChip(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PAID" || normalized === "SUCCESS") {
    return '<span class="badge badge-success">Success</span>';
  }
  if (normalized === "FAILED") {
    return '<span class="badge badge-danger">Failed</span>';
  }
  if (normalized === "ABANDONED") {
    return '<span class="badge badge-warn">Abandoned</span>';
  }
  return '<span class="badge badge-neutral">Pending</span>';
}

function setLoading(button, isLoading, loadingText) {
  if (!button) return;
  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : button.dataset.defaultText;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function setLoginMessage(message, isError = false) {
  const el = document.getElementById("admin-login-message");
  if (!el) return;
  el.style.color = isError ? "#b91c1c" : "var(--primary-dark)";
  el.textContent = message;
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
