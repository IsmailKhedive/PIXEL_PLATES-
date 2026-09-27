const params = new URLSearchParams(window.location.search);
if (params.get("key")) {
  localStorage.setItem("pixelPlatesDeviceKey", params.get("key"));
  history.replaceState({}, "", "customer.html");
}
const deviceKey = localStorage.getItem("pixelPlatesDeviceKey");

const $ = (selector) => document.querySelector(selector);

const money = (value) => {
  return `UGX ${Number(value || 0).toLocaleString("en-UG", {
    maximumFractionDigits: 0,
  })}`;
};
const escapeHtml = (value) => {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );
};
const state = {
  menu: [],
  cart: [],
  orders: [],
};
async function api(path, options = {}) {
  const response = await fetch(`/api/customer${path}`, {
    ...options,

    headers: {
      "Content-Type": "application/json",
      "X-Device-Key": deviceKey || "",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Unable to connect");
  }

  return data;
}
function showError(message) {
  const element = $("#customer-error");
  element.textContent = message;
  element.hidden = false;
  clearTimeout(showError.timer);
  showError.timer = setTimeout(() => {
    element.hidden = true;
  }, 5000);
}
function updateClock() {
  const now = new Date();
  $("#customer-clock").textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  $("#customer-date").textContent = now.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
async function loadCustomerApplication() {
  try {
    const [session, menu, orders] = await Promise.all([
      api("/session"),
      api("/menu"),
      api("/orders"),
    ]);
    state.menu = menu;
    state.orders = orders;
    $("#customer-restaurant").textContent =
      session.restaurantName || "PIXEL PLATES";
    $("#customer-table").textContent = `TABLE ${session.tableNumber}`;

    renderMenu();
    renderCart();
    renderTracking();
  } catch (error) {
    showError(error.message);
  }
}

function renderMenu() {
  const categories = [
    ...new Set(state.menu.map((item) => item.category || "Other")),
  ];

  const container = $("#customer-menu");

  if (!categories.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>The menu is currently empty</h3>
        <p>Please ask a member of staff for help.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = categories
    .map((category) => {
      const items = state.menu.filter(
        (item) => (item.category || "Other") === category,
      );

      return `
        <div class="customer-category">
          <h2>${escapeHtml(category)}</h2>

          <div class="menu-grid">
            ${items
              .map(
                (item) => `
              <article
                class="food-card ${item.stock ? "" : "sold-out"}"
              >
                ${
                  item.image_url
                    ? `
                      <img
                        class="food-image"
                        src="${escapeHtml(item.image_url)}"
                        alt="${escapeHtml(item.name)}"
                      >
                    `
                    : ""
                }

                <h3>${escapeHtml(item.name)}</h3>

                <div>
                  <strong>${money(item.price)}</strong>

                  <button
                    data-add="${item.id}"
                    class="add-button"
                    ${item.stock ? "" : "disabled"}
                    aria-label="Add ${escapeHtml(item.name)}"
                  >
                    +
                  </button>
                </div>
<small class="preparation-time">
  Approximately
  ${Number(item.preparation_minutes || 15)}
  minutes
</small>
                <small>
                  ${item.stock ? `${item.stock} available` : "Sold out"}
                </small>
              </article>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      addToCart(Number(button.dataset.add));
    });
  });
}

function addToCart(id) {
  const menuItem = state.menu.find((item) => item.id === id);

  if (!menuItem) {
    return;
  }

  const cartItem = state.cart.find((item) => item.id === id);

  const currentQuantity = cartItem?.quantity || 0;

  if (currentQuantity >= menuItem.stock) {
    showError(`Only ${menuItem.stock} ${menuItem.name} available`);

    return;
  }

  if (cartItem) {
    cartItem.quantity += 1;
  } else {
    state.cart.push({
      id: menuItem.id,
      name: menuItem.name,
      price: Number(menuItem.price),
      quantity: 1,
    });
  }

  renderCart();
}

function changeQuantity(id, amount) {
  const cartItem = state.cart.find((item) => item.id === id);

  if (!cartItem) {
    return;
  }

  if (amount > 0) {
    addToCart(id);
    return;
  }

  cartItem.quantity += amount;

  if (cartItem.quantity < 1) {
    state.cart = state.cart.filter((item) => item.id !== id);
  }

  renderCart();
}

function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  const total = state.cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  $("#customer-cart-count").textContent =
    `${count} item${count === 1 ? "" : "s"}`;

  $("#customer-total").textContent = money(total);

  const container = $("#customer-cart-items");

  if (!state.cart.length) {
    container.innerHTML = `
      <div class="empty-cart">
        <span>0</span>
        <p>Choose something delicious.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = state.cart
    .map(
      (item) => `
      <div class="cart-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${money(item.price)}</small>
        </div>

        <div class="quantity">
          <button
            data-minus="${item.id}"
            aria-label="Decrease ${escapeHtml(item.name)}"
          >
            &minus;
          </button>

          <span>${item.quantity}</span>

          <button
            data-plus="${item.id}"
            aria-label="Increase ${escapeHtml(item.name)}"
          >
            +
          </button>
        </div>
      </div>
    `,
    )
    .join("");

  document.querySelectorAll("[data-plus]").forEach((button) => {
    button.addEventListener("click", () => {
      changeQuantity(Number(button.dataset.plus), 1);
    });
  });

  document.querySelectorAll("[data-minus]").forEach((button) => {
    button.addEventListener("click", () => {
      changeQuantity(Number(button.dataset.minus), -1);
    });
  });
}

function renderTracking() {
  const statuses = ["New", "Preparing", "Ready", "Completed"];

  const activeOrders = state.orders.filter(
    (order) => order.status !== "Completed",
  );

  $("#tracking-count").textContent = activeOrders.length
    ? `(${activeOrders.length})`
    : "";

  const container = $("#customer-tracking");

  if (!state.orders.length) {
    container.innerHTML = `
      <div class="empty-state">
        Your orders will appear here.
      </div>
    `;

    return;
  }

  container.innerHTML = state.orders
    .map((order) => {
      const currentStatusIndex = statuses.indexOf(order.status);

      const orderItems = order.items
        .map((item) => {
          return `${item.quantity}&times; ${escapeHtml(item.item_name)}`;
        })
        .join(" &middot; ");

      return `
        <article class="tracking-card">
          <div>
            <span>ORDER #${order.id}</span>

            <strong>
              ${escapeHtml(order.status)}
            </strong>
          </div>

          <div class="status-track">
            ${statuses
              .map(
                (status, index) => `
              <i class="${index <= currentStatusIndex ? "done" : ""}">
                ${status}
              </i>
            `,
              )
              .join("")}
          </div>

          <p>${orderItems}</p>

          <small>
            ${new Date(order.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            &middot;
            ${money(order.total)}
            &middot;
            ${escapeHtml(order.payment_status)}
          </small>
        </article>
      `;
    })
    .join("");
}


$("#place-customer-order").addEventListener("click", async () => {
  if (!state.cart.length) {
    showError("Add at least one item");
    return;
  }

  const button = $("#place-customer-order");
  button.disabled = true;

  try {
    await api("/orders", {
      method: "POST",

      body: JSON.stringify({
        items: state.cart.map(({ id, quantity }) => ({
          id,
          quantity,
        })),
      }),
    });

    state.cart = [];

    await loadCustomerApplication();

    document.querySelector('[data-customer-view="tracking"]').click();
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
  }
});


document.querySelectorAll("[data-customer-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-customer-view]").forEach((entry) => {
      entry.classList.toggle("active", entry === button);
    });

    $("#customer-menu").hidden = button.dataset.customerView !== "menu";

    $("#customer-tracking").hidden = button.dataset.customerView !== "tracking";
  });
});

updateClock();

setInterval(updateClock, 1000);

loadCustomerApplication();


setInterval(async () => {
  try {
    state.orders = await api("/orders");
    renderTracking();
  } catch {
   
  }
}, 10000);
