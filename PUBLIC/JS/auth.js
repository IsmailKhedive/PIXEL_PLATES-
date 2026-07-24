const form = document.querySelector("#login-form");
const errorElement = document.querySelector("#error");
const loginButton = document.querySelector("#login-button");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");

if (localStorage.getItem("token") && localStorage.getItem("user")) {
  window.location.replace("dashboard.html");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  errorElement.textContent = "";
  errorElement.hidden = true;

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
