import { apiPost } from "./api.js";
import { saveSession, isLoggedIn } from "./session.js";

// already logged in? skip straight to the dashboard
if (isLoggedIn()) {
  window.location.replace("dashboard.html");
}

const form = document.getElementById("login-form");
const errorBox = document.getElementById("login-error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.classList.add("hidden");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";

  try {
    const data = await apiPost("/auth/login", { email, password });
    saveSession(data.access_token, data.user);
    window.location.href = "dashboard.html";
  } catch (err) {
    errorBox.textContent = err.message || "Invalid email or password";
    errorBox.classList.remove("hidden");
    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";
  }
});