const API_BASE =
  window.STORE_API_BASE ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:5000/api"
    : "https://your-render-backend.onrender.com/api");
const CASHFREE_MODE = window.STORE_CASHFREE_MODE || "sandbox";

const STORAGE_KEYS = {
  products: "store_products",
  cart: "store_cart_local",
  users: "store_users",
  currentUser: "store_current_user",
  orders: "store_orders",
  pendingOrder: "store_pending_order"
};

const defaultProducts = [
  {
    id: 101,
    name: "Classic White Sneakers",
    category: "Footwear",
    price: 79.99,
    rating: 4.6,
    stock: 18,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80",
    description: "Clean low-top sneakers with cushioned insole for all-day comfort."
  },
  {
    id: 102,
    name: "Minimal Leather Backpack",
    category: "Accessories",
    price: 119.99,
    rating: 4.7,
    stock: 9,
    image: "https://images.unsplash.com/photo-1491637639811-60e2756cc1c7?auto=format&fit=crop&w=900&q=80",
    description: "Structured backpack with laptop sleeve and water-resistant lining."
  },
  {
    id: 103,
    name: "Linen Blend Shirt",
    category: "Apparel",
    price: 49.5,
    rating: 4.3,
    stock: 30,
    image: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
    description: "Breathable shirt with relaxed fit, perfect for warm weather."
  },
  {
    id: 104,
    name: "Ceramic Table Lamp",
    category: "Home",
    price: 64.25,
    rating: 4.4,
    stock: 14,
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    description: "Modern lamp with warm ambient glow and matte ceramic base."
  },
  {
    id: 105,
    name: "Sport Chronograph Watch",
    category: "Accessories",
    price: 149.99,
    rating: 4.8,
    stock: 8,
    image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=900&q=80",
    description: "Bold timepiece with stainless steel case and durable strap."
  },
  {
    id: 106,
    name: "Soft Knit Hoodie",
    category: "Apparel",
    price: 59.99,
    rating: 4.2,
    stock: 22,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
    description: "Comfort hoodie with a clean silhouette and brushed inner lining."
  }
];

document.addEventListener("DOMContentLoaded", async () => {
  initializeStore();
  setupNavigation();
  updateCartCount();
  renderNavUser();

  const page = document.body.dataset.page;
  if (page === "home") renderHome();
  if (page === "products") renderProductsPage();
  if (page === "product-details") renderProductDetailsPage();
  if (page === "cart") renderCartPage();
  if (page === "checkout") await renderCheckoutPage();
  if (page === "login") renderAuthPage();
  if (page === "admin") renderAdminPage();
});

function initializeStore() {
  if (!localStorage.getItem(STORAGE_KEYS.products)) {
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(defaultProducts));
  }

  if (!localStorage.getItem(STORAGE_KEYS.cart)) {
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.users)) {
    localStorage.setItem(
      STORAGE_KEYS.users,
      JSON.stringify([
        {
          id: "admin_local",
          name: "Store Admin",
          email: "admin@store.com",
          password: "admin12345",
          isAdmin: true
        }
      ])
    );
  }

  if (!localStorage.getItem(STORAGE_KEYS.orders)) {
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify([]));
  }
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
  return readJSON(STORAGE_KEYS.products, []);
}

function saveProducts(products) {
  localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
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

function getOrders() {
  return readJSON(STORAGE_KEYS.orders, []);
}

function saveOrders(orders) {
  localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
}

function updateCartCount() {
  const badge = document.getElementById("cart-count");
  if (!badge) return;

  const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
  badge.textContent = String(count);
}

function addToCart(productId, quantity = 1) {
  const cart = getCart();
  const product = getProducts().find((item) => item.id === productId);
  if (!product) {
    return { ok: false, message: "Product not found." };
  }

  const existing = cart.find((item) => item.productId === productId);
  const currentQty = existing ? existing.quantity : 0;
  if (currentQty + quantity > product.stock) {
    return { ok: false, message: `Only ${product.stock} units available` };
  }

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }

  saveCart(cart);
  updateCartCount();
  return { ok: true };
}

function removeFromCart(productId) {
  saveCart(getCart().filter((item) => item.productId !== productId));
  updateCartCount();
}

function setCartQuantity(productId, quantity) {
  const cart = getCart();
  const product = getProducts().find((item) => item.id === productId);
  const target = cart.find((item) => item.productId === productId);
  if (!target || !product) return;

  if (quantity <= 0) {
    removeFromCart(productId);
    return;
  }

  target.quantity = Math.min(quantity, product.stock);
  saveCart(cart);
  updateCartCount();
}

function renderProductCards(products, mount) {
  mount.innerHTML = products
    .map(
      (product) => `
      <article class="product-card">
        <a href="product-details.html?id=${product.id}">
          <img src="${product.image}" alt="${escapeHTML(product.name)}">
        </a>
        <div class="product-body">
          <p class="category-pill">${escapeHTML(product.category)}</p>
          <h3 class="product-title">
            <a href="product-details.html?id=${product.id}">${escapeHTML(product.name)}</a>
          </h3>
          <div class="meta-row">
            <span class="price">${formatPrice(product.price)}</span>
            <span class="rating">${Number(product.rating).toFixed(1)} / 5</span>
          </div>
          <div class="meta-row">
            <span class="soft-text">Stock: ${product.stock}</span>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" data-cart-add="${product.id}" type="button" ${
              product.stock <= 0 ? "disabled" : ""
            }>${product.stock <= 0 ? "Out of Stock" : "Add to Cart"}</button>
            <a class="btn btn-light" href="product-details.html?id=${product.id}">Details</a>
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
      const result = addToCart(Number(button.dataset.cartAdd), 1);
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

  searchInput.addEventListener("input", applyFilters);
  categoryFilter.addEventListener("change", applyFilters);
  applyFilters();
}

function renderProductDetailsPage() {
  const mount = document.getElementById("product-details-container");
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const productId = Number(params.get("id"));
  const product = getProducts().find((item) => item.id === productId);

  if (!product) {
    mount.innerHTML =
      '<p class="empty-state">Product not found. <a class="text-link" href="products.html">Back to products</a></p>';
    return;
  }

  mount.innerHTML = `
    <section class="product-detail">
      <img src="${product.image}" alt="${escapeHTML(product.name)}">
      <div>
        <p class="category-pill">${escapeHTML(product.category)}</p>
        <h1>${escapeHTML(product.name)}</h1>
        <p class="rating">Rating: ${Number(product.rating).toFixed(1)} / 5</p>
        <h2 class="price">${formatPrice(product.price)}</h2>
        <p class="soft-text">${escapeHTML(product.description)}</p>
        <p class="soft-text">Stock available: ${product.stock}</p>
        <div class="btn-row">
          <div class="qty-control">
            <button type="button" id="detail-decrease">-</button>
            <input type="number" id="detail-quantity" min="1" value="1">
            <button type="button" id="detail-increase">+</button>
          </div>
          <button id="detail-add" class="btn btn-primary" type="button" ${
            product.stock <= 0 ? "disabled" : ""
          }>${product.stock <= 0 ? "Out of Stock" : "Add to Cart"}</button>
        </div>
      </div>
    </section>
  `;

  const quantityInput = document.getElementById("detail-quantity");
  const increaseBtn = document.getElementById("detail-increase");
  const decreaseBtn = document.getElementById("detail-decrease");
  const addBtn = document.getElementById("detail-add");

  increaseBtn.addEventListener("click", () => {
    quantityInput.value = String(Math.min(product.stock, Number(quantityInput.value || 1) + 1));
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
  const productsMap = new Map(getProducts().map((product) => [product.id, product]));
  const items = getCart()
    .map((entry) => {
      const product = productsMap.get(entry.productId);
      if (!product) return null;
      const quantity = Math.min(entry.quantity, product.stock);
      if (quantity <= 0) return null;
      return {
        ...product,
        quantity,
        lineTotal: Number((product.price * quantity).toFixed(2))
      };
    })
    .filter(Boolean);

  return {
    items,
    subtotal: Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2))
  };
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
            <img src="${item.image}" alt="${escapeHTML(item.name)}">
            <div>
              <p class="cart-title">${escapeHTML(item.name)}</p>
              <p class="rating">${formatPrice(item.price)} each | Stock: ${item.stock}</p>
            </div>
            <div class="qty-control">
              <button type="button" data-qty-dec="${item.id}">-</button>
              <input type="number" value="${item.quantity}" readonly>
              <button type="button" data-qty-inc="${item.id}">+</button>
            </div>
            <strong>${formatPrice(item.lineTotal)}</strong>
            <button class="btn btn-danger btn-small" data-remove="${item.id}" type="button">Remove</button>
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
      removeFromCart(Number(button.dataset.remove));
      renderCartPage();
    });
  });

  mount.querySelectorAll("[data-qty-inc]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.qtyInc);
      const item = items.find((row) => row.id === id);
      if (!item) return;
      setCartQuantity(id, item.quantity + 1);
      renderCartPage();
    });
  });

  mount.querySelectorAll("[data-qty-dec]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.qtyDec);
      const item = items.find((row) => row.id === id);
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

    const pendingOrder = {
      items,
      total: subtotal,
      customer: {
        name: document.getElementById("checkout-fullname").value.trim(),
        email: document.getElementById("checkout-email").value.trim(),
        phone: document.getElementById("checkout-phone").value.trim(),
        address: document.getElementById("checkout-address").value.trim(),
        city: document.getElementById("checkout-city").value.trim(),
        zip: document.getElementById("checkout-zip").value.trim()
      },
      createdAt: new Date().toISOString()
    };

    try {
      const response = await apiFetch("/cashfree/create-order", {
        method: "POST",
        body: JSON.stringify({
          orderAmount: subtotal,
          customerName: pendingOrder.customer.name,
          customerEmail: pendingOrder.customer.email,
          customerPhone: pendingOrder.customer.phone,
          orderNote: `Store order with ${items.length} item(s)`,
          returnUrl: `${window.location.origin}${window.location.pathname}?order_id={order_id}`
        })
      });

      localStorage.setItem(
        STORAGE_KEYS.pendingOrder,
        JSON.stringify({
          ...pendingOrder,
          orderId: response.orderId,
          cfOrderId: response.cfOrderId
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
    const result = await apiFetch("/cashfree/verify-payment", {
      method: "POST",
      body: JSON.stringify({ orderId })
    });

    const pendingOrder = readJSON(STORAGE_KEYS.pendingOrder, null);
    const paid = result.orderStatus === "PAID";

    if (paid && pendingOrder && pendingOrder.orderId === orderId) {
      const orders = getOrders();
      orders.unshift({
        ...pendingOrder,
        paymentStatus: result.orderStatus,
        verifiedAt: new Date().toISOString()
      });
      saveOrders(orders);
      localStorage.removeItem(STORAGE_KEYS.pendingOrder);
      saveCart([]);
      updateCartCount();
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
      location.href = user.isAdmin ? "admin.html" : "index.html";
    }, 800);
  });
}

function renderAdminPage() {
  const authMsg = document.getElementById("admin-auth-message");
  const form = document.getElementById("admin-product-form");
  const listMount = document.getElementById("admin-products-list");
  const title = document.getElementById("admin-form-title");
  const cancelBtn = document.getElementById("admin-cancel-btn");
  const uploadBtn = document.getElementById("admin-upload-btn");
  const imageFileInput = document.getElementById("admin-image-file");
  if (!authMsg || !form || !listMount || !title || !cancelBtn || !uploadBtn || !imageFileInput) return;

  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.isAdmin) {
    authMsg.textContent = "Admin login required. Use admin@store.com / admin12345.";
    form.classList.add("hidden");
    listMount.innerHTML = '<p class="empty-state">No access.</p>';
    return;
  }

  authMsg.textContent = `Logged in as admin: ${currentUser.email}`;
  uploadBtn.disabled = true;
  imageFileInput.disabled = true;
  uploadBtn.textContent = "Upload disabled";
  uploadBtn.addEventListener("click", () => {
    authMsg.textContent = "Image upload is disabled in the simplified localStorage mode. Use an image URL.";
  });

  const idInput = document.getElementById("admin-product-id");
  const nameInput = document.getElementById("admin-name");
  const categoryInput = document.getElementById("admin-category");
  const priceInput = document.getElementById("admin-price");
  const stockInput = document.getElementById("admin-stock");
  const ratingInput = document.getElementById("admin-rating");
  const imageInput = document.getElementById("admin-image");
  const descriptionInput = document.getElementById("admin-description");

  const resetForm = () => {
    form.reset();
    idInput.value = "";
    title.textContent = "Add Product";
  };

  const renderAdminProducts = () => {
    const products = getProducts();
    listMount.innerHTML = products
      .map(
        (product) => `
        <article class="admin-item">
          <img src="${product.image}" alt="${escapeHTML(product.name)}">
          <div>
            <strong>${escapeHTML(product.name)}</strong>
            <p class="soft-text">${escapeHTML(product.category)} | ${formatPrice(product.price)} | Stock: ${product.stock}</p>
          </div>
          <div class="btn-row">
            <button class="btn btn-light btn-small" data-edit-id="${product.id}" type="button">Edit</button>
            <button class="btn btn-danger btn-small" data-delete-id="${product.id}" type="button">Delete</button>
          </div>
        </article>
      `
      )
      .join("");

    listMount.querySelectorAll("[data-edit-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const product = getProducts().find((entry) => entry.id === Number(button.dataset.editId));
        if (!product) return;
        idInput.value = String(product.id);
        nameInput.value = product.name;
        categoryInput.value = product.category;
        priceInput.value = String(product.price);
        stockInput.value = String(product.stock);
        ratingInput.value = String(product.rating);
        imageInput.value = product.image;
        descriptionInput.value = product.description;
        title.textContent = "Edit Product";
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    listMount.querySelectorAll("[data-delete-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = Number(button.dataset.deleteId);
        saveProducts(getProducts().filter((entry) => entry.id !== id));
        saveCart(getCart().filter((item) => item.productId !== id));
        updateCartCount();
        renderAdminProducts();
      });
    });
  };

  cancelBtn.addEventListener("click", resetForm);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const id = Number(idInput.value);
    const products = getProducts();
    const product = {
      id: id || Date.now(),
      name: nameInput.value.trim(),
      category: categoryInput.value.trim(),
      price: Number(priceInput.value),
      stock: Number(stockInput.value),
      rating: Number(ratingInput.value),
      image: imageInput.value.trim(),
      description: descriptionInput.value.trim()
    };

    const index = products.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      products[index] = product;
    } else {
      products.unshift(product);
    }

    saveProducts(products);
    authMsg.textContent = id ? "Product updated successfully." : "Product created successfully.";
    resetForm();
    renderAdminProducts();
  });

  renderAdminProducts();
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

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

