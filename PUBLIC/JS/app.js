const MENU_CATEGORIES = [
  "Main dishes",
  "Appetizer",
  "Drinks",
  "Desserts",
  "Extras",
  "Chef's picks",
];
const token = localStorage.getItem("token");
let user;
try {
  user = JSON.parse(localStorage.getItem("user"));
} catch {
  user = null;
}
if (!token || !user) {
  window.location.replace("login.html");
}
const $ = (selector) => document.querySelector(selector);
const money = (value) =>
  `UGX ${Number(value || 0).toLocaleString("en-UG", {
    maximumFractionDigits: 0,
  })}`;
const escapeHtml = (value) =>
  String(value ?? "").replace(
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
const state = {
  menu: [],
  cart: [],
  orders: [],
  users: [],
  kitchenKnownIds: new Set(),
  soundEnabled: false,
};
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (response.status === 401) {
    localStorage.clear();
    window.location.replace("login.html");
    throw new Error("Your session has expired");
  }
  const data =
    response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "The request could not be completed");
  }
  return data;
}
function notify(message, type = "success") {
  const notice = $("#notice");
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => {
    notice.hidden = true;
  }, 4000);
}
const viewsByRole = {
  admin: ["order", "kitchen", "inventory", "staff", "sales", "devices"],
  manager: ["order", "kitchen", "inventory", "staff", "sales"],
  waiter: ["order"],
  kitchen: ["kitchen"],
};
const viewTitles = {
  order: "Order Desk",
  kitchen: "Kitchen Board",
  inventory: "Menu & Stock",
  staff: "Staff Accounts",
  sales: "Sales & Payments",
  devices: "Table Tablets",
};
const allowedViews = viewsByRole[user.role] || [];
if (!allowedViews.length) {
  localStorage.clear();
  window.location.replace("login.html");
}
$("#restaurant-name").textContent = user.restaurantName || "Your Restaurant";
$("#user-name").textContent = user.name;
$("#user-role").textContent = user.role.toUpperCase();
function updateClock() {
  $("#today").textContent = new Date()
    .toLocaleString("en-UG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .toUpperCase();
}
updateClock();
setInterval(updateClock, 1000);
$("#logout").addEventListener("click", () => {
  localStorage.clear();
  window.location.replace("login.html");
});
document.querySelectorAll("#app-nav button").forEach((button) => {
  const viewName = button.dataset.view;
  const isAllowed = allowedViews.includes(viewName);
  button.hidden = !isAllowed;
  button.classList.toggle("role-hidden", !isAllowed);
  button.setAttribute("aria-hidden", String(!isAllowed));
  if (isAllowed) {
    button.addEventListener("click", () => {
      openView(viewName);
    });
  }
});
async function openView(name) {
  if (!allowedViews.includes(name)) {
    return;
  }
  document.querySelectorAll("#app-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === name);
  });
  $("#heading").textContent = viewTitles[name];
  try {
    if (name === "order") {
      await loadOrderDesk();
    }
    if (name === "kitchen") {
      await loadKitchen();
    }
    if (name === "inventory") {
      await loadInventory();
    }
    if (name === "staff") {
      await loadStaff();
    }
    if (name === "sales") {
      await loadSales();
    }
    if (name === "devices") {
      await loadDevices();
    }
  } catch (error) {
    notify(error.message, "error");
  }
}
async function loadOrderDesk() {
  state.menu = await api("/menu");
  const tableOptions = Array.from({ length: 25 }, (_, index) => index + 1)
    .map(
      (tableNumber) => `
        <option value="${tableNumber}">
          Table ${tableNumber}
        </option>
      `,
    )
    .join("");
  $("#order").innerHTML = `
    <div class="order-toolbar">
      <div class="category-tabs">
        <button
          class="active"
          data-category="all"
        >
          All
        </button>
        ${MENU_CATEGORIES.map(
          (category) => `
            <button
              data-category="${escapeHtml(category)}"
            >
              ${escapeHtml(category)}
            </button>
          `,
        ).join("")}
      </div>
      <label class="search">
        <span>Search</span>
        <input
          id="menu-search"
          placeholder="Find a dish"
        >
      </label>
    </div>
    <div class="order-layout-with-tables">
      <aside class="table-selector">
        <label for="table-number">
          TABLE
        </label>
        <select id="table-number">
          ${tableOptions}
        </select>
      </aside>
      <div
        id="menu-grid"
        class="menu-grid"
      ></div>
      <aside class="cart-panel">
        <div class="cart-heading">
          <div>
            <p>CURRENT ORDER</p>
            <h2 id="selected-table-heading">
              Table 1
            </h2>
          </div>
          <span id="cart-count">
            0 items
          </span>
        </div>
        <div
          id="cart-items"
          class="cart-items"
        ></div>
        <div class="cart-footer">
          <label for="order-note">
            ORDER NOTE
          </label>
          <textarea
            id="order-note"
            maxLength="500"
            rows="3"
            placeholder="e.g. no onions, extra plates"
          ></textarea>
          <div class="cart-total">
            <span>Total</span>
            <strong id="cart-total">
              UGX 0
            </strong>
          </div>
          <button id="send-order">
            Send to kitchen
            <span>&rarr;</span>
          </button>
        </div>
      </aside>
    </div>
  `;
  $("#menu-search").addEventListener("input", renderMenu);
  $("#table-number").addEventListener("change", () => {
    $("#selected-table-heading").textContent =
      `Table ${$("#table-number").value}`;
  });
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-category]").forEach((entry) => {
        entry.classList.remove("active");
      });
      button.classList.add("active");
      renderMenu();
    });
  });
  $("#send-order").addEventListener("click", sendOrder);
  renderMenu();
  renderCart();
}
function renderMenu() {
  const activeCategory = $("[data-category].active")?.dataset.category || "all";
  const search = $("#menu-search")?.value.trim().toLowerCase() || "";
  const items = state.menu.filter((item) => {
    const correctCategory =
      activeCategory === "all" || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(search);
    return correctCategory && matchesSearch;
  });
  $("#menu-grid").innerHTML = items.length
    ? items
        .map(
          (item) => `
        <article
          class="food-card ${item.stock === 0 ? "sold-out" : ""}"
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
          <div class="food-card-top">
            <span>
              ${escapeHtml(item.category || "Dish")}
            </span>
            <span>${item.stock} left</span>
          </div>
          <h3>${escapeHtml(item.name)}</h3>
          <div>
            <strong>${money(item.price)}</strong>
            <button
              class="add-button"
              data-add="${item.id}"
              ${item.stock === 0 ? "disabled" : ""}
              aria-label="Add ${escapeHtml(item.name)}"
            >
              +
            </button>
          </div>
        </article>
      `,
        )
        .join("")
    : `
      <div class="empty-state">
        <h3>No dishes found</h3>
        <p>Try another category or search.</p>
      </div>
    `;
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
    notify(`Only ${menuItem.stock} ${menuItem.name} available`, "error");
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
  if (cartItem.quantity <= 0) {
    state.cart = state.cart.filter((item) => item.id !== id);
  }
  renderCart();
}
function renderCart() {
  const container = $("#cart-items");
  if (!container) {
    return;
  }
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = state.cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  $("#cart-count").textContent = `${count} item${count === 1 ? "" : "s"}`;
  $("#cart-total").textContent = money(total);
  container.innerHTML = state.cart.length
    ? state.cart
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
              aria-label="Decrease"
            >
              &minus;
            </button>
            <span>${item.quantity}</span>
            <button
              data-plus="${item.id}"
              aria-label="Increase"
            >
              +
            </button>
          </div>
        </div>
      `,
        )
        .join("")
    : `
      <div class="empty-cart">
        <span>0</span>
        <p>Select dishes to begin an order.</p>
      </div>
    `;
  document.querySelectorAll("[data-minus]").forEach((button) => {
    button.addEventListener("click", () => {
      changeQuantity(Number(button.dataset.minus), -1);
    });
  });
  document.querySelectorAll("[data-plus]").forEach((button) => {
    button.addEventListener("click", () => {
      changeQuantity(Number(button.dataset.plus), 1);
    });
  });
}
async function sendOrder() {
  const tableNumber = $("#table-number").value;
  const orderNote = $("#order-note").value.trim();
  if (!tableNumber) {
    notify("Select a table", "error");
    return;
  }
  if (!state.cart.length) {
    notify("Add at least one dish", "error");
    return;
  }
  if (orderNote.length > 500) {
    notify("The order note is too long", "error");
    return;
  }
  const button = $("#send-order");
  button.disabled = true;
  try {
    await api("/orders", {
      method: "POST",
      body: JSON.stringify({
        tableNumber,
        orderNote,
        items: state.cart.map(({ id, quantity }) => ({
          id,
          quantity,
        })),
      }),
    });
    state.cart = [];
    notify(`Order for table ${tableNumber} sent to the kitchen`);
    await loadOrderDesk();
  } catch (error) {
    notify(error.message, "error");
    button.disabled = false;
  }
}
async function loadKitchen() {
  const orders = await api("/orders");
  const newOrders = orders.filter(
    (order) => order.status === "New" && !state.kitchenKnownIds.has(order.id),
  );
  if (state.kitchenKnownIds.size && newOrders.length) {
    notify(
      `${newOrders.length} new kitchen order${
        newOrders.length === 1 ? "" : "s"
      }`,
    );
    if (state.soundEnabled) {
      playKitchenAlert();
    }
  }
  orders.forEach((order) => {
    state.kitchenKnownIds.add(order.id);
  });
  state.orders = orders;
  const activeOrders = orders.filter((order) => order.status !== "Completed");
  const columns = ["New", "Preparing", "Ready"];
  $("#kitchen").innerHTML = `
    <div class="kitchen-summary">
      ${columns
        .map(
          (status) => `
        <div>
          <strong>
            ${activeOrders.filter((order) => order.status === status).length}
          </strong>

          <span>${status}</span>
        </div>
      `,
        )
        .join("")}

      <button
        id="toggle-sound"
        class="secondary"
      >
        ${state.soundEnabled ? "Sound on" : "Enable sound"}
      </button>
      <button
        id="refresh-kitchen"
        class="secondary"
      >
        Refresh board
      </button>
    </div>
    <div class="kitchen-board">
      ${columns
        .map((status) => {
          const columnOrders = activeOrders.filter(
            (order) => order.status === status,
          );
          return `
          <section class="kitchen-column">
            <header>
              <h2>${status}</h2>
              <span>${columnOrders.length}</span>
            </header>
            <div>
              ${
                columnOrders.length
                  ? columnOrders.map(orderTicket).join("")
                  : `
                    <p class="column-empty">
                      No ${status.toLowerCase()} orders
                    </p>
                  `
              }
            </div>
          </section>
        `;
        })
        .join("")}
    </div>
  `;
  $("#refresh-kitchen").addEventListener("click", loadKitchen);
  $("#toggle-sound").addEventListener("click", async () => {
    state.soundEnabled = !state.soundEnabled;
    if (state.soundEnabled) {
      playKitchenAlert();
    }
    await loadKitchen();
  });

  document.querySelectorAll("[data-status-id]").forEach((button) => {
    button.addEventListener("click", () => {
      advanceOrder(Number(button.dataset.statusId), button.dataset.next);
    });
  });
}
function playKitchenAlert() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.18, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.45);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.45);
}
function orderTicket(order) {
  const nextStatus = {
    New: "Preparing",
    Preparing: "Ready",
    Ready: "Completed",
  }[order.status];
  const buttonLabel = {
    New: "Start preparing",
    Preparing: "Mark ready",
    Ready: "Complete order",
  }[order.status];
  const actionButton = ["admin", "kitchen"].includes(user.role)
    ? `
        <button
          data-status-id="${order.id}"
          data-next="${nextStatus}"
        >
          ${buttonLabel}
        </button>
      `
    : "";
  return `
    <article
      class="ticket status-${order.status.toLowerCase()}"
    >
      <div class="ticket-head">
        <div>
          <span>ORDER #${order.id}</span>
          <h3>
            Table ${escapeHtml(order.table_number)}
          </h3>
        </div>
        <time>
          ${new Date(order.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>

      <ul>
        ${order.items
          .map(
            (item) => `
          <li>
            <strong>${item.quantity}</strong>
            <span>${escapeHtml(item.item_name)}</span>
          </li>
        `,
          )
          .join("")}
      </ul>
${
  order.order_note
    ? `
      <div class="ticket-note">
        <strong>ORDER NOTE</strong>
        <p>
          ${escapeHtml(order.order_note)}
        </p>
      </div>
    `
    : ""
}
      <div class="ticket-foot">
        <small>
          ${escapeHtml(order.waiter_name)}
        </small>
        ${actionButton}
      </div>
    </article>
  `;
}
async function advanceOrder(id, status) {
  try {
    await api(`/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadKitchen();
  } catch (error) {
    notify(error.message, "error");
  }
}
async function loadInventory() {
  state.menu = await api("/menu?all=1");
  $("#inventory").innerHTML = `
    <div class="section-actions">
      <p class="muted">
        ${state.menu.length} menu items
      </p>
      <button id="add-item">
        + Add menu item
      </button>
    </div>
    <div class="data-table">
      <div class="table-head">
        <span>Dish</span>
        <span>Category</span>
        <span>Price</span>
        <span>Stock</span>
        <span>Status</span>
        <span></span>
      </div>
      ${state.menu
        .map(
          (item) => `
        <div class="table-row">
          <strong>${escapeHtml(item.name)}</strong>
          <span>
            ${escapeHtml(item.category || "Uncategorized")}
          </span>
          <span>${money(item.price)}</span>
          <span class="stock ${item.stock < 10 ? "low" : ""}">
            ${item.stock}
          </span>
          <span>
            <i class="status-pill ${item.active ? "active" : "inactive"}">
              ${item.active ? "Active" : "Hidden"}
            </i>
          </span>
          <span>
  <i class="status-pill ${item.active ? "active" : "inactive"}">
    ${item.active ? "Active" : "Hidden"}
  </i>
</span>
<div class="inventory-actions">
  <button
    class="row-action"
    data-edit-item="${item.id}"
    type="button"
  >
    Edit
  </button>
  <button
    class="row-action remove-action"
    data-remove-item="${item.id}"
    data-remove-name="${escapeHtml(item.name)}"
    type="button"
  >
    Remove
  </button>
</div>
      `,
        )
        .join("")}
    </div>
  `;
  $("#add-item").addEventListener("click", () => openItemDialog());
  document.querySelectorAll("[data-edit-item]").forEach((button) => {
    button.addEventListener("click", () => {
      openItemDialog(Number(button.dataset.editItem));
    });
  });
  document.querySelectorAll("[data-remove-item]").forEach((button) => {
    button.addEventListener("click", async () => {
      const itemName = button.dataset.removeName;
      const confirmed = window.confirm(`Remove ${itemName} from the menu?`);
      if (!confirmed) {
        return;
      }
      button.disabled = true;
      try {
        await api(`/menu/${button.dataset.removeItem}`, {
          method: "DELETE",
        });
        notify("Menu item removed");
        await loadInventory();
      } catch (error) {
        notify(error.message, "error");
        button.disabled = false;
      }
    });
  });
}
  try {
    if (button) {
      button.disabled = true;
      button.textContent =
        "Preparing report...";
    }
    const response = await fetch(
      "/api/reports/sales/export?days=30",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!response.ok) {
      const data = await response
        .json()
        .catch(() => ({}));

      throw new Error(
        data.message ||
        "Unable to download report"
      );
    }
    const file = await response.blob();
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      `pixel-plates-sales-${
        new Date().toISOString().slice(0, 10)
      }.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify("Sales report downloaded");
  } catch (error) {
    notify(error.message, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "Download sales report";
    }
  }
function openItemDialog(id = null) {
  const item = state.menu.find((entry) => entry.id === id);
  $("#item-dialog-title").textContent = item ? "Edit dish" : "Add dish";
  $("#item-id").value = item?.id || "";
  $("#item-name").value = item?.name || "";
  $("#item-category").value = item?.category || "";
  $("#item-price").value = item?.price || "";
  $("#item-stock").value = item?.stock ?? "";
  $("#item-active").checked = item ? Boolean(item.active) : true;
  $("#item-image").value = "";
  $("#item-promotional-label").value =
  item?.promotional_label || "";
$("#item-description").value =
  item?.description || "";
$("#item-discount-percent").value =
  item?.discount_percent || 0;
$("#item-preparation-minutes").value =
  item?.preparation_minutes || 15;
$("#item-featured").checked =
  Boolean(item?.featured);
$("#item-promotion-start").value =
  toDateTimeInput(item?.promotion_start);
$("#item-promotion-end").value =
  toDateTimeInput(item?.promotion_end);
  $("#item-dialog").showModal();
}
$("#item-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#item-id").value;
 const payload = {
  name: $("#item-name").value.trim(),
  category:
    $("#item-category").value,
  price:
    Number($("#item-price").value),
  preparationMinutes:
    Number(
      $("#item-preparation-minutes").value
    ),
  stock:
    Number($("#item-stock").value),
};
  const image = $("#item-image").files[0];
  if (image) {
    if (image.size > 5 * 1024 * 1024) {
      notify("The image must be smaller than 5 MB", "error");

      return;
    }
    payload.imageData = await fileToDataUrl(image);
  }
  if (id) {
    payload.active = $("#item-active").checked;
  }
  try {
    await api(id ? `/menu/${id}` : "/menu", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    $("#item-dialog").close();
    notify(id ? "Menu item updated" : "Menu item created");
    await loadInventory();
  } catch (error) {
    notify(error.message, "error");
  }
});
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    $("#item-dialog").close();
  });
});
async function loadStaff() {
  state.users = await api("/users");
  $("#staff").innerHTML = `
    <div class="staff-layout">
      <section>
        <div class="section-title">
          <p>TEAM DIRECTORY</p>
          <h2>
            ${state.users.length} staff accounts
          </h2>
        </div>
        <div class="staff-list">
          ${state.users
            .map(
              (member) => `
            <div class="staff-row">
              <span class="avatar">
                ${escapeHtml(member.name).slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>
                  ${escapeHtml(member.name)}
                </strong>
                <small>
                  ${escapeHtml(member.email)}
                </small>
              </div>
              <i class="role-pill">
                ${escapeHtml(member.role)}
              </i>
            </div>
          `,
            )
            .join("")}
        </div>
      </section>
      <form
        id="staff-form"
        class="staff-form"
      >
        <div class="section-title">
          <p>NEW ACCOUNT</p>
          <h2>Add staff member</h2>
        </div>

        <label>
          Full name
          <input id="staff-name" required>
        </label>

        <label>
          Email
          <input
            id="staff-email"
            type="email"
            required
          >
        </label>
        <label>
          Role
          <select id="staff-role">
  <option value="waiter">
    Waiter
  </option>

  <option value="kitchen">
    Kitchen
  </option>

  ${
    user.role === "admin"
      ? `
        <option value="manager">
          Manager
        </option>

        <option value="admin">
          Administrator
        </option>
      `
      : ""
  }
</select>
        </label>

        <label>
          Temporary password

          <input
            id="staff-password"
            type="password"
            minlength="8"
            required
          >
        </label>

        <button type="submit">
          Create account
        </button>
      </form>
    </div>
  `;

  $("#staff-form").addEventListener("submit", createStaff);
}
async function createStaff(event) {
  event.preventDefault();

  try {
    await api("/users", {
      method: "POST",

      body: JSON.stringify({
        name: $("#staff-name").value,
        email: $("#staff-email").value,
        role: $("#staff-role").value,
        password: $("#staff-password").value,
      }),
    });

    notify("Staff account created");
    await loadStaff();
  } catch (error) {
    notify(error.message, "error");
  }
}
async function loadSales() {
  const [report, orders] = await Promise.all([
    api("/reports/sales?days=30"),
    api("/orders"),
  ]);
  const summary = report.summary;
  $("#sales").innerHTML = `
    <div class="metrics">
      <article>
        <span>Gross sales</span>
        <strong>
          ${money(summary.gross_sales)}
        </strong>
      </article>
      <article>
        <span>Paid</span>
        <strong>
          ${money(summary.paid_sales)}
        </strong>
      </article>

      <article>
        <span>Outstanding</span>
        <strong>
          ${money(summary.outstanding)}
        </strong>
      </article>

      <article>
        <span>Orders</span>
        <strong>${summary.orders}</strong>
      </article>
    </div>
    ${
      user.role === "admin"
        ? `
      <div class="sales-report-actions">
        <button
          id="download-sales"
          class="download-sales-button"
          type="button"
        >
          Download sales report
        </button>
      </div>
    `
        : ""
    }
    <div class="sales-layout">
      <section>
        <div class="section-title">
          <p>LAST 30 DAYS</p>
          <h2>Daily sales</h2>
        </div>

        <div class="data-table sales-table">
          ${
            report.daily.length
              ? report.daily
                  .map(
                    (day) => `
                  <div class="sales-row">
                    <span>
                      ${new Date(day.day).toLocaleDateString()}
                    </span>

                    <span>
                      ${day.orders} orders
                    </span>

                    <strong>
                      ${money(day.sales)}
                    </strong>
                  </div>
                `,
                  )
                  .join("")
              : `
                <div class="empty-state">
                  No sales yet
                </div>
              `
          }
        </div>
      </section>

      <section>
        <div class="section-title">
          <p>PAYMENTS</p>
          <h2>Record payment</h2>
        </div>

        <div class="payment-list">
          ${orders
            .slice(0, 50)
            .map(
              (order) => `
            <div class="payment-row">
              <div>
                <strong>
                  #${order.id}
                  &middot;
                  Table ${escapeHtml(order.table_number)}
                </strong>

                <small>
                  ${money(order.total)}
                  &middot;
                  ${escapeHtml(order.payment_status)}
                </small>
              </div>

              ${
                order.payment_status === "Paid"
                  ? `
                    <i class="status-pill">
                      Paid
                      &middot;
                      ${escapeHtml(order.payment_method)}
                    </i>
                  `
                  : `
                    <select data-pay="${order.id}">
                      <option value="">
                        Mark paid&hellip;
                      </option>
                      <option>Cash</option>
                      <option>Card</option>
                      <option>
                        Mobile Money
                      </option>
                    </select>
                  `
              }
            </div>
          `,
            )
            .join("")}
        </div>
      </section>
    </div>
  `;
const downloadButton = $("#download-sales");
  document.querySelectorAll("[data-pay]").forEach((select) => {
    select.addEventListener("change", async () => {
      if (!select.value) {
        return;
      }

      try {
        await api(`/orders/${select.dataset.pay}/payment`, {
          method: "PATCH",

          body: JSON.stringify({
            status: "Paid",
            method: select.value,
          }),
        });

        notify("Payment recorded");
        await loadSales();
      } catch (error) {
        notify(error.message, "error");
      }
    });
  });
}
async function loadDevices() {
  const devices = await api("/devices");

  $("#devices").innerHTML = `
    <div class="device-layout">
      <section>
        <div class="section-title">
          <p>REGISTERED TABLETS</p>

          <h2>
            ${devices.length} devices
          </h2>
        </div>

        <div class="staff-list">
          ${
            devices.length
              ? devices
                  .map(
                    (device) => `
                  <div class="staff-row">
                    <span class="avatar">
                      ${escapeHtml(device.table_number)}
                    </span>

                    <div>
                      <strong>
                        ${escapeHtml(device.name)}
                      </strong>

                      <small>
                        ${
                          device.last_seen_at
                            ? `Last seen ${new Date(
                                device.last_seen_at,
                              ).toLocaleString()}`
                            : "Never connected"
                        }
                      </small>
                    </div>

                    <button
                      class="row-action"
                      data-device="${device.id}"
                      data-active="${device.active ? "0" : "1"}"
                    >
                      ${device.active ? "Disable" : "Enable"}
                    </button>
                  </div>
                `,
                  )
                  .join("")
              : `
                <div class="empty-state">
                  No tablets registered
                </div>
              `
          }
        </div>
      </section>

      <form
        id="device-form"
        class="staff-form"
      >
        <div class="section-title">
          <p>NEW TABLET</p>
          <h2>Create secure key</h2>
        </div>

        <label>
          Table number

          <input
            id="device-table"
            maxlength="20"
            required
          >
        </label>

        <label>
          Device name

          <input
            id="device-name"
            maxlength="100"
            placeholder="e.g. Window tablet"
          >
        </label>

        <button type="submit">
          Generate tablet link
        </button>

        <div id="device-key-result"></div>
      </form>
    </div>
  `;

  $("#device-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const result = await api("/devices", {
        method: "POST",

        body: JSON.stringify({
          tableNumber: $("#device-table").value,

          name: $("#device-name").value,
        }),
      });

      const url = new URL(result.customerUrl, window.location.origin).href;

      $("#device-key-result").innerHTML = `
          <div class="key-result">
            <strong>
              Save this one-time link
            </strong>

            <p>
              The secure key cannot be recovered later.
            </p>

            <input
              readonly
              value="${escapeHtml(url)}"
            >

            <a
              href="${escapeHtml(url)}"
              target="_blank"
              rel="noopener"
            >
              Open customer tablet
            </a>
          </div>
        `;
    } catch (error) {
      notify(error.message, "error");
    }
  });

  document.querySelectorAll("[data-device]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/devices/${button.dataset.device}`, {
          method: "PATCH",

          body: JSON.stringify({
            active: button.dataset.active === "1",
          }),
        });

        await loadDevices();
      } catch (error) {
        notify(error.message, "error");
      }
    });
  });
}

openView(allowedViews[0]);

setInterval(() => {
  if ($("#kitchen").classList.contains("active")) {
    loadKitchen().catch((error) => {
      notify(error.message, "error");
    });
  }
}, 10000);
