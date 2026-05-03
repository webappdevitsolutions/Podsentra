const API_BASE = "https://podsentra.onrender.com/api";
const CASHFREE_MODE = window.STORE_CASHFREE_MODE || "sandbox";
const STORE_NAME = "Podsecntra";

const STORAGE_KEYS = {
  cart: "podsecntra_cart_local",
  users: "podsecntra_users",
  currentUser: "podsecntra_current_user",
  pendingOrder: "podsecntra_pending_order",
  orderHistory: "podsecntra_order_history",
  cartSessionId: "podsecntra_cart_session_id",
  cartSessionDbId: "podsecntra_cart_session_db_id"
};

const fallbackProducts = [
  {
    id: "fallback-101",
    name: "Classic White Sneakers",
    category: "Footwear",
    price: 79.99,
    rating: 4.6,
    stock: 18,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80",
    description: "Clean low-top sneakers with cushioned insole for all-day comfort."
  },
  {
    id: "fallback-102",
    name: "Minimal Leather Backpack",
    category: "Accessories",
    price: 119.99,
    rating: 4.7,
    stock: 9,
    image: "https://images.unsplash.com/photo-1491637639811-60e2756cc1c7?auto=format&fit=crop&w=900&q=80",
    description: "Structured backpack with laptop sleeve and water-resistant lining."
  },
  {
    id: "fallback-103",
    name: "Linen Blend Shirt",
    category: "Apparel",
    price: 49.5,
    rating: 4.3,
    stock: 30,
    image: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
    description: "Breathable shirt with relaxed fit, perfect for warm weather."
  },
  {
    id: "fallback-104",
    name: "Ceramic Table Lamp",
    category: "Home",
    price: 64.25,
    rating: 4.4,
    stock: 14,
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    description: "Modern lamp with warm ambient glow and matte ceramic base."
  }
];

const state = {
  products: [],
  productsLoaded: false,
  cartSyncInFlight: false,
  cartSessionId: null,
  cartSessionDbId: null
};

document.addEventListener("DOMContentLoaded", async () => {
  initializeStore();
  setupNavigation();
  updateCartCount();
  renderNavUser();

  await loadProductsFromApi();

  const page = document.body.dataset.page;
  if (page === "home") renderHome();
  if (page === "products") renderProductsPage();
  if (page === "product-details") renderProductDetailsPage();
  if (page === "cart") renderCartPage();
  if (page === "checkout") await renderCheckoutPage();
  if (page === "login") renderAuthPage();
  if (page === "admin") renderAdminPage();

  await syncCartSession().catch(() => {});
});

function initializeStore() {
  if (!localStorage.getItem(STORAGE_KEYS.cart)) {
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.users)) {
    localStorage.setItem(
      STORAGE_KEYS.users,
      JSON.stringify([
        {
          id: `user_${Date.now()}`,
          name: "Demo User",
          email: "demo@podsecntra.com",
          password: "demo12345",
          isAdmin: false
        }
      ])
    );
  }

  if (!localStorage.getItem(STORAGE_KEYS.orderHistory)) {
    localStorage.setItem(STORAGE_KEYS.orderHistory, JSON.stringify([]));
  }

  state.cartSessionId = localStorage.getItem(STORAGE_KEYS.cartSessionId) || `session_${cryptoRandomId()}`;
  state.cartSessionDbId = localStorage.getItem(STORAGE_KEYS.cartSessionDbId) || null;
  localStorage.setItem(STORAGE_KEYS.cartSessionId, state.cartSessionId);
}

async function loadProductsFromApi() {
  try {
    const response = await apiFetch("/products");
    state.products = (response.products || []).map(normalizeProduct);
    state.productsLoaded = true;
  } catch (error) {
    console.warn("Using fallback products because API fetch failed:", error.message);
    state.products = fallbackProducts.map(normalizeProduct);
    state.productsLoaded = true;
  }
}

function normalizeProduct(raw = {}) {
  const comparePrice =
    raw.compare_at_price === null || raw.compare_at_price === undefined || raw.compare_at_price === ""
      ? null
      : Number(raw.compare_at_price);
  return {
    id: raw.id,
    name: String(raw.name || "Untitled Product"),
    category: String(raw.category || "General"),
    price: Number(raw.price || 0),
    compare_at_price: comparePrice && comparePrice > Number(raw.price || 0) ? comparePrice : null,
    rating: Number(raw.rating || 4.5),
    stock: Math.max(0, Number(raw.stock || 0)),
    image: String(raw.image_url || raw.image || "https://images.unsplash.com/photo-1560393464-5c69a73c5770?auto=format&fit=crop&w=900&q=80"),
    description: String(raw.description || "")
  };
}

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

function renderNavUser() {
  const navUserEl = document.getElementById("nav-user");
  if (!navUserEl) return;

  const currentUser = getCurrentUser();
  if (!currentUser) {
    navUserEl.textContent = "Guest";
    return;
  }

  navUserEl.innerHTML = `
    Hi, ${escapeHTML(currentUser.name)}
    <button id="logout-btn" class="btn btn-small btn-light" type="button">Logout</button>
  `;

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEYS.currentUser);
      renderNavUser();
      location.href = "index.html";
    });
  }
}

function getProducts() {
  return state.products;
}

function getCart() {
  return readJSON(STORAGE_KEYS.cart, []);
}

function saveCart(cart) {
  localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart));
}

function getUsers() {
  return readJSON(STORAGE_KEYS.users, []);
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

function getCurrentUser() {
  return readJSON(STORAGE_KEYS.currentUser, null);
}

function setCurrentUser(user) {
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
}

function getOrderHistory() {
  return readJSON(STORAGE_KEYS.orderHistory, []);
}

function saveOrderHistory(orders) {
  localStorage.setItem(STORAGE_KEYS.orderHistory, JSON.stringify(orders));
}

function updateCartCount() {
  const badge = document.getElementById("cart-count");
  if (!badge) return;
  const count = getCart().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  badge.textContent = String(count);
}

function findProductById(productId) {
  return getProducts().find((item) => String(item.id) === String(productId));
}

function addToCart(productId, quantity = 1) {
  const cart = getCart();
  const product = findProductById(productId);
  if (!product) {
    return { ok: false, message: "Product not found." };
  }

  const existing = cart.find((item) => String(item.productId) === String(productId));
  const currentQty = existing ? Number(existing.quantity || 0) : 0;
  if (currentQty + quantity > Number(product.stock || 0)) {
    return { ok: false, message: `Only ${product.stock} units available` };
  }

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId: product.id, quantity });
  }

  saveCart(cart);
  updateCartCount();
  syncCartSession().catch(() => {});
  return { ok: true };
}

function removeFromCart(productId) {
  saveCart(getCart().filter((item) => String(item.productId) !== String(productId)));
  updateCartCount();
  syncCartSession().catch(() => {});
}

function setCartQuantity(productId, quantity) {
  const cart = getCart();
  const product = findProductById(productId);
  const target = cart.find((item) => String(item.productId) === String(productId));
  if (!target || !product) return;

  if (quantity <= 0) {
    removeFromCart(productId);
    return;
  }

  target.quantity = Math.min(quantity, Number(product.stock || 0));
  saveCart(cart);
  updateCartCount();
  syncCartSession().catch(() => {});
}

function renderProductCards(products, mount) {
  mount.innerHTML = products
    .map(
      (product) => `
      <article class="product-card">
        <a href="product-details.html?id=${encodeURIComponent(product.id)}">
          <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async">
        </a>
        <div class="product-body">
          <p class="category-pill">${escapeHTML(product.category)}</p>
          <h3 class="product-title">
            <a href="product-details.html?id=${encodeURIComponent(product.id)}">${escapeHTML(product.name)}</a>
          </h3>
          <div class="meta-row">
            ${renderPricePair(product.price, product.compare_at_price)}
            <span class="rating">${Number(product.rating).toFixed(1)} / 5</span>
          </div>
          <div class="meta-row">
            <span class="soft-text">Stock: ${Number(product.stock || 0)}</span>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" data-cart-add="${escapeHTML(product.id)}" type="button" ${
              Number(product.stock || 0) <= 0 ? "disabled" : ""
            }>${Number(product.stock || 0) <= 0 ? "Out of Stock" : "Add to Cart"}</button>
            <a class="btn btn-light" href="product-details.html?id=${encodeURIComponent(product.id)}">Details</a>
          </div>
        </div>
      </article>
    `
    )
    .join("");
}

function attachCardEvents(scope = document) {
  scope.querySelectorAll("[data-cart-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = addToCart(button.dataset.cartAdd, 1);
      button.textContent = result.ok ? "Added" : result.message;
      setTimeout(() => {
        button.textContent = "Add to Cart";
      }, 1000);
    });
  });
}

function renderHome() {
  const mount = document.getElementById("featured-products");
  if (!mount) return;
  renderProductCards(getProducts().slice(0, 4), mount);
  attachCardEvents(mount);
}

function renderProductsPage() {
  const mount = document.getElementById("products-grid");
  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");
  const emptyState = document.getElementById("products-empty");
  if (!mount || !searchInput || !categoryFilter || !emptyState) return;

  const products = getProducts();
  const categories = [...new Set(products.map((item) => item.category))];
  categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  categoryFilter.innerHTML += categories
    .map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`)
    .join("");

  const applyFilters = () => {
    const query = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;
    const filtered = products.filter((product) => {
      const matchesQuery =
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);
      const matchesCategory = category === "all" || product.category === category;
      return matchesQuery && matchesCategory;
    });

    renderProductCards(filtered, mount);
    attachCardEvents(mount);
    emptyState.classList.toggle("hidden", filtered.length > 0);
  };

  searchInput.addEventListener("input", debounce(applyFilters, 250));
  categoryFilter.addEventListener("change", applyFilters);
  applyFilters();
}

function renderProductDetailsPage() {
  const mount = document.getElementById("product-details-container");
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  const product = findProductById(productId);

  if (!product) {
    mount.innerHTML =
      '<p class="empty-state">Product not found. <a class="text-link" href="products.html">Back to products</a></p>';
    return;
  }

  mount.innerHTML = `
    <section class="product-detail">
      <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async">
      <div>
        <p class="category-pill">${escapeHTML(product.category)}</p>
        <h1>${escapeHTML(product.name)}</h1>
        <p class="rating">Rating: ${Number(product.rating).toFixed(1)} / 5</p>
        <h2 class="price-row">${renderPricePair(product.price, product.compare_at_price)}</h2>
        <p class="soft-text">${escapeHTML(product.description)}</p>
        <p class="soft-text">Stock available: ${Number(product.stock || 0)}</p>
        <div class="btn-row">
          <div class="qty-control">
            <button type="button" id="detail-decrease">-</button>
            <input type="number" id="detail-quantity" min="1" value="1">
            <button type="button" id="detail-increase">+</button>
          </div>
          <button id="detail-add" class="btn btn-primary" type="button" ${
            Number(product.stock || 0) <= 0 ? "disabled" : ""
          }>${Number(product.stock || 0) <= 0 ? "Out of Stock" : "Add to Cart"}</button>
        </div>
      </div>
    </section>
  `;

  const quantityInput = document.getElementById("detail-quantity");
  const increaseBtn = document.getElementById("detail-increase");
  const decreaseBtn = document.getElementById("detail-decrease");
  const addBtn = document.getElementById("detail-add");

  increaseBtn.addEventListener("click", () => {
    quantityInput.value = String(Math.min(Number(product.stock || 0), Number(quantityInput.value || 1) + 1));
  });

  decreaseBtn.addEventListener("click", () => {
    quantityInput.value = String(Math.max(1, Number(quantityInput.value || 1) - 1));
  });

  addBtn.addEventListener("click", () => {
    const result = addToCart(product.id, Math.max(1, Number(quantityInput.value || 1)));
    addBtn.textContent = result.ok ? "Added" : result.message;
    setTimeout(() => {
      addBtn.textContent = "Add to Cart";
    }, 1000);
  });
}

function getCartDetails() {
  const productsMap = new Map(getProducts().map((product) => [String(product.id), product]));
  const items = getCart()
    .map((entry) => {
      const product = productsMap.get(String(entry.productId));
      if (!product) return null;
      const quantity = Math.min(Number(entry.quantity || 0), Number(product.stock || 0));
      if (quantity <= 0) return null;
      return {
        ...product,
        quantity,
        lineTotal: Number((Number(product.price) * quantity).toFixed(2))
      };
    })
    .filter(Boolean);

  return {
    items,
    subtotal: Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2))
  };
}

function serializeCartItems(items = []) {
  return items.map((item) => ({
    productId: item.id,
    name: item.name,
    category: item.category,
    price: Number(item.price),
    quantity: Number(item.quantity),
    lineTotal: Number(item.lineTotal)
  }));
}

async function syncCartSession(customerOverrides = {}, status = "active") {
  if (state.cartSyncInFlight) return null;
  state.cartSyncInFlight = true;

  try {
    const currentUser = getCurrentUser();
    const { items, subtotal } = getCartDetails();

    const payload = {
      sessionId: state.cartSessionId,
      status,
      items: serializeCartItems(items),
      totalAmount: subtotal,
      customerName: customerOverrides.name || currentUser?.name || "",
      customerEmail: customerOverrides.email || currentUser?.email || "",
      customerPhone: customerOverrides.phone || "",
      orderId: customerOverrides.orderId || null,
      paymentSessionId: customerOverrides.paymentSessionId || null
    };

    const response = await apiFetch("/cart/session", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (response.session) {
      state.cartSessionId = response.session.session_id || state.cartSessionId;
      state.cartSessionDbId = response.session.id || state.cartSessionDbId;
      localStorage.setItem(STORAGE_KEYS.cartSessionId, state.cartSessionId);
      if (state.cartSessionDbId) {
        localStorage.setItem(STORAGE_KEYS.cartSessionDbId, state.cartSessionDbId);
      }
    }

    return response.session || null;
  } catch (error) {
    console.warn("Cart sync failed:", error.message);
    return null;
  } finally {
    state.cartSyncInFlight = false;
  }
}

function renderCartPage() {
  const mount = document.getElementById("cart-container");
  if (!mount) return;

  const { items, subtotal } = getCartDetails();
  if (!items.length) {
    mount.innerHTML =
      '<p class="empty-state">Your cart is empty. <a class="text-link" href="products.html">Start shopping</a></p>';
    return;
  }

  mount.innerHTML = `
    <section class="cart-table">
      ${items
        .map(
          (item) => `
          <div class="cart-row">
            <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" loading="lazy" decoding="async">
            <div>
              <p class="cart-title">${escapeHTML(item.name)}</p>
              <p class="rating">${formatPrice(item.price)} each | Stock: ${item.stock}</p>
            </div>
            <div class="qty-control">
              <button type="button" data-qty-dec="${escapeHTML(item.id)}">-</button>
              <input type="number" value="${item.quantity}" readonly>
              <button type="button" data-qty-inc="${escapeHTML(item.id)}">+</button>
            </div>
            <strong>${formatPrice(item.lineTotal)}</strong>
            <button class="btn btn-danger btn-small" data-remove="${escapeHTML(item.id)}" type="button">Remove</button>
          </div>
        `
        )
        .join("")}
    </section>
    <div class="cart-summary">
      <h2>Subtotal: ${formatPrice(subtotal)}</h2>
      <a class="btn btn-primary" href="checkout.html">Proceed to Checkout</a>
    </div>
  `;

  mount.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      removeFromCart(button.dataset.remove);
      renderCartPage();
    });
  });

  mount.querySelectorAll("[data-qty-inc]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.qtyInc;
      const item = items.find((row) => String(row.id) === String(id));
      if (!item) return;
      setCartQuantity(id, item.quantity + 1);
      renderCartPage();
    });
  });

  mount.querySelectorAll("[data-qty-dec]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.qtyDec;
      const item = items.find((row) => String(row.id) === String(id));
      if (!item) return;
      setCartQuantity(id, item.quantity - 1);
      renderCartPage();
    });
  });
}

async function renderCheckoutPage() {
  const mount = document.getElementById("checkout-content");
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const returnedOrderId = params.get("order_id");

  if (returnedOrderId) {
    mount.innerHTML = '<p class="empty-state">Verifying your Cashfree payment...</p>';
    await verifyReturnedCashfreeOrder(mount, returnedOrderId);
    return;
  }

  const currentUser = getCurrentUser();
  const { items, subtotal } = getCartDetails();
  if (!items.length) {
    mount.innerHTML =
      '<p class="empty-state">Your cart is empty. <a class="text-link" href="products.html">Browse products</a></p>';
    return;
  }

  mount.innerHTML = `
    <div class="checkout-layout">
      <section class="card">
        <h2>Order Summary</h2>
        ${items
          .map(
            (item) => `
            <div class="meta-row">
              <span>${escapeHTML(item.name)} x ${item.quantity}</span>
              <strong>${formatPrice(item.lineTotal)}</strong>
            </div>
          `
          )
          .join("")}
        <hr>
        <div class="meta-row">
          <h3>Total</h3>
          <h3>${formatPrice(subtotal)}</h3>
        </div>
      </section>

      <section class="card">
        <h2>Shipping Details</h2>
        <p id="checkout-message" class="status-msg"></p>
        <form id="checkout-form">
          <label>Full Name</label>
          <input type="text" id="checkout-fullname" value="${escapeHTML(currentUser?.name || "")}" required>
          <label>Email</label>
          <input type="email" id="checkout-email" value="${escapeHTML(currentUser?.email || "")}" required>
          <label>Phone</label>
          <input type="tel" id="checkout-phone" value="9999999999" required>
          <label>Address</label>
          <input type="text" id="checkout-address" required>
          <label>City</label>
          <input type="text" id="checkout-city" required>
          <label>ZIP Code</label>
          <input type="text" id="checkout-zip" required>
          <label>Payment Method</label>
          <select id="checkout-payment-method" required>
            <option value="cashfree">Cashfree</option>
          </select>
          <button class="btn btn-primary" type="submit" id="checkout-submit">Pay with Cashfree</button>
        </form>
      </section>
    </div>
  `;

  const checkoutForm = document.getElementById("checkout-form");
  const checkoutMsg = document.getElementById("checkout-message");
  const submitBtn = document.getElementById("checkout-submit");

  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setLoading(submitBtn, true, "Creating order...");
    checkoutMsg.textContent = "";

    const customer = {
      name: document.getElementById("checkout-fullname").value.trim(),
      email: document.getElementById("checkout-email").value.trim(),
      phone: document.getElementById("checkout-phone").value.trim(),
      address: document.getElementById("checkout-address").value.trim(),
      city: document.getElementById("checkout-city").value.trim(),
      zip: document.getElementById("checkout-zip").value.trim()
    };

    const pendingOrder = {
      items: serializeCartItems(items),
      total: subtotal,
      customer,
      cartSessionId: state.cartSessionId,
      createdAt: new Date().toISOString()
    };

    try {
      await syncCartSession(customer, "active");

      const response = await apiFetch("/cashfree/create-order", {
        method: "POST",
        body: JSON.stringify({
          orderAmount: subtotal,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          customerCity: customer.city,
          customerZip: customer.zip,
          items: pendingOrder.items,
          cartSessionId: state.cartSessionId,
          orderNote: `${STORE_NAME} order with ${items.length} item(s)`,
          returnUrl: `${window.location.origin}${window.location.pathname}?order_id={order_id}`
        })
      });

      localStorage.setItem(
        STORAGE_KEYS.pendingOrder,
        JSON.stringify({
          ...pendingOrder,
          orderId: response.orderId,
          cfOrderId: response.cfOrderId,
          paymentSessionId: response.paymentSessionId
        })
      );

      await openCashfreeCheckout(response.paymentSessionId);
    } catch (error) {
      checkoutMsg.textContent = error.message;
      setLoading(submitBtn, false, "Pay with Cashfree");
    }
  });
}

async function verifyReturnedCashfreeOrder(mount, orderId) {
  try {
    const pendingOrder = readJSON(STORAGE_KEYS.pendingOrder, null);

    const result = await apiFetch("/cashfree/verify-payment", {
      method: "POST",
      body: JSON.stringify({
        orderId,
        cartSessionId: state.cartSessionId,
        customerName: pendingOrder?.customer?.name || "",
        customerEmail: pendingOrder?.customer?.email || "",
        customerPhone: pendingOrder?.customer?.phone || "",
        customerAddress: pendingOrder?.customer?.address || "",
        customerCity: pendingOrder?.customer?.city || "",
        customerZip: pendingOrder?.customer?.zip || "",
        items: pendingOrder?.items || [],
        amount: pendingOrder?.total || 0
      })
    });

    const paid = result.orderStatus === "PAID";

    if (paid && pendingOrder && pendingOrder.orderId === orderId) {
      const orderHistory = getOrderHistory();
      orderHistory.unshift({
        ...pendingOrder,
        paymentStatus: result.orderStatus,
        verifiedAt: new Date().toISOString()
      });
      saveOrderHistory(orderHistory);
      localStorage.removeItem(STORAGE_KEYS.pendingOrder);
      saveCart([]);
      updateCartCount();
      await syncCartSession(
        {
          name: pendingOrder.customer?.name,
          email: pendingOrder.customer?.email,
          phone: pendingOrder.customer?.phone,
          orderId,
          paymentSessionId: result.paymentSessionId
        },
        "completed"
      );
    }

    mount.innerHTML = paid
      ? `
        <div class="card">
          <h2>Payment Successful</h2>
          <p class="soft-text">Your Cashfree payment was verified successfully.</p>
          <p><strong>Order ID:</strong> ${escapeHTML(orderId)}</p>
          <div class="btn-row">
            <a class="btn btn-primary" href="index.html">Continue Shopping</a>
            <a class="btn btn-light" href="cart.html">View Cart</a>
          </div>
        </div>
      `
      : `
        <div class="card">
          <h2>Payment Not Completed</h2>
          <p class="soft-text">Current payment status: ${escapeHTML(result.orderStatus || "UNKNOWN")}</p>
          <div class="btn-row">
            <a class="btn btn-primary" href="checkout.html">Try Again</a>
            <a class="btn btn-light" href="cart.html">Back to Cart</a>
          </div>
        </div>
      `;
  } catch (error) {
    mount.innerHTML = `
      <div class="card">
        <h2>Verification Failed</h2>
        <p class="soft-text">${escapeHTML(error.message)}</p>
        <a class="btn btn-primary" href="checkout.html">Return to Checkout</a>
      </div>
    `;
  }
}

function renderAuthPage() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const showLoginBtn = document.getElementById("show-login");
  const showRegisterBtn = document.getElementById("show-register");
  const authMessage = document.getElementById("auth-message");
  if (!loginForm || !registerForm || !showLoginBtn || !showRegisterBtn || !authMessage) return;

  const toggleAuthView = (mode) => {
    const loginMode = mode === "login";
    loginForm.classList.toggle("hidden", !loginMode);
    registerForm.classList.toggle("hidden", loginMode);
    showLoginBtn.className = `btn btn-small ${loginMode ? "btn-primary" : "btn-light"}`;
    showRegisterBtn.className = `btn btn-small ${loginMode ? "btn-light" : "btn-primary"}`;
    authMessage.textContent = "";
  };

  showLoginBtn.addEventListener("click", () => toggleAuthView("login"));
  showRegisterBtn.addEventListener("click", () => toggleAuthView("register"));

  registerForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const users = getUsers();
    const user = {
      id: `user_${Date.now()}`,
      name: document.getElementById("register-name").value.trim(),
      email: document.getElementById("register-email").value.trim().toLowerCase(),
      password: document.getElementById("register-password").value,
      isAdmin: false
    };

    if (users.some((existing) => existing.email === user.email)) {
      authMessage.textContent = "Email already registered.";
      return;
    }

    users.push(user);
    saveUsers(users);
    setCurrentUser({ id: user.id, name: user.name, email: user.email, isAdmin: false });
    authMessage.textContent = "Registration successful. Redirecting...";
    renderNavUser();
    setTimeout(() => {
      location.href = "index.html";
    }, 800);
  });

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;
    const user = getUsers().find((entry) => entry.email === email && entry.password === password);

    if (!user) {
      authMessage.textContent = "Invalid email or password.";
      return;
    }

    setCurrentUser({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: Boolean(user.isAdmin)
    });
    authMessage.textContent = "Login successful. Redirecting...";
    renderNavUser();
    setTimeout(() => {
      location.href = "index.html";
    }, 800);
  });
}

function renderAdminPage() {
  const authMsg = document.getElementById("admin-auth-message");
  const form = document.getElementById("admin-product-form");
  const listMount = document.getElementById("admin-products-list");
  if (!authMsg || !form || !listMount) return;

  authMsg.textContent = "Podsecntra admin has moved to the new dashboard.";
  form.classList.add("hidden");
  listMount.innerHTML = `
    <div class="empty-state">
      <p>Open the new admin dashboard for products, orders, carts, and analytics.</p>
      <p><a class="btn btn-primary" href="admin-dashboard.html">Go to Admin Dashboard</a></p>
    </div>
  `;
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

function ensureCashfreeLoaded() {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
    document.body.appendChild(script);
  });
}

async function openCashfreeCheckout(paymentSessionId) {
  await ensureCashfreeLoaded();
  const cashfree = window.Cashfree({ mode: CASHFREE_MODE });
  const checkoutResult = await cashfree.checkout({
    paymentSessionId,
    redirectTarget: "_self"
  });

  if (checkoutResult && checkoutResult.error) {
    throw new Error(checkoutResult.error.message || "Cashfree checkout failed");
  }
}

function setLoading(button, isLoading, loadingText) {
  if (!button) return;
  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : button.dataset.defaultText;
}

function formatPrice(value) {
  return `Rs ${Number(value).toFixed(2)}`;
}

function renderPricePair(price, compareAtPrice) {
  const base = `<span class="price">${formatPrice(price)}</span>`;
  if (!compareAtPrice || Number(compareAtPrice) <= Number(price)) {
    return base;
  }

  const discount = Math.round(((Number(compareAtPrice) - Number(price)) / Number(compareAtPrice)) * 100);
  return `
    <span class="price-stack">
      ${base}
      <span class="compare-price">${formatPrice(compareAtPrice)}</span>
      <span class="discount-badge">${discount}% OFF</span>
    </span>
  `;
}

function debounce(fn, delayMs = 250) {
  let timerId = null;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delayMs);
  };
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function cryptoRandomId() {
  const values = new Uint32Array(2);
  window.crypto.getRandomValues(values);
  return `${Date.now()}_${values[0].toString(16)}${values[1].toString(16)}`;
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
