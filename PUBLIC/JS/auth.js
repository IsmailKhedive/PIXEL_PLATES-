const form = document.querySelector("#login-form");

const errorElement = document.querySelector("#error");

const successElement = document.querySelector("#success-message");

const loginButton = document.querySelector("#login-button");

const emailInput = document.querySelector("#email");

const passwordInput = document.querySelector("#password");

const togglePasswordButton = document.querySelector("#toggle-password");

const forgotPasswordButton = document.querySelector("#forgot-password");

const forgotDialog = document.querySelector("#forgot-dialog");

const closeForgotDialogButton = document.querySelector("#close-forgot-dialog");

const forgotForm = document.querySelector("#forgot-form");

const forgotEmailInput = document.querySelector("#forgot-email");

const forgotResult = document.querySelector("#forgot-result");

const googleLoginButton = document.querySelector("#google-login");


if (localStorage.getItem("token") && localStorage.getItem("user")) {
  window.location.replace("dashboard.html");
}

togglePasswordButton.addEventListener("click", () => {
  const passwordIsVisible = passwordInput.type === "text";

  passwordInput.type = passwordIsVisible ? "password" : "text";

  togglePasswordButton.setAttribute(
    "aria-label",
    passwordIsVisible ? "Show password" : "Hide password",
  );

  togglePasswordButton.setAttribute("aria-pressed", String(!passwordIsVisible));

  togglePasswordButton.classList.toggle("active", !passwordIsVisible);
});


form.addEventListener("submit", async (event) => {
  event.preventDefault();

  hideMessages();

  loginButton.disabled = true;
  loginButton.textContent = "Signing in...";

  const email = emailInput.value.trim().toLowerCase();

  const password = passwordInput.value;

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Unable to sign in");
    }

    localStorage.setItem("token", data.token);

    localStorage.setItem("user", JSON.stringify(data.user));

    successElement.textContent = "Login successful. Opening workspace...";

    successElement.hidden = false;

    window.location.replace("dashboard.html");
  } catch (error) {
    console.error("Login error:", error);

    errorElement.textContent =
      error.message || "Unable to connect to the server";

    errorElement.hidden = false;

    loginButton.disabled = false;

    loginButton.textContent = "Enter workspace";
  }
});


forgotPasswordButton.addEventListener("click", () => {
  forgotEmailInput.value = emailInput.value.trim();

  forgotResult.hidden = true;
  forgotResult.textContent = "";

  forgotDialog.showModal();

  forgotEmailInput.focus();
});


closeForgotDialogButton.addEventListener("click", () => {
  forgotDialog.close();
});

forgotDialog.addEventListener("click", (event) => {
  if (event.target === forgotDialog) {
    forgotDialog.close();
  }
});


forgotForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const email = forgotEmailInput.value.trim().toLowerCase();

  if (!email) {
    return;
  }

  forgotResult.innerHTML = `
      <strong>Password recovery</strong>

      <p>
        If this is a waiter or kitchen
        account, contact your restaurant
        administrator for a new password.
      </p>

      <p>
        If this is the main administrator
        account, change
        <code>SEED_ADMIN_PASSWORD</code>
        in the server's <code>.env</code>
        file and run
        <code>npm.cmd run seed</code>.
      </p>
    `;

  forgotResult.hidden = false;
});


googleLoginButton.addEventListener("click", () => {
  hideMessages();

  errorElement.textContent =
    "Google login is not configured yet. " +
    "Use your staff email and password.";

  errorElement.hidden = false;
});

function hideMessages() {
  errorElement.hidden = true;
  successElement.hidden = true;

  errorElement.textContent = "";
  successElement.textContent = "";
}
