// Everything about "who is logged in" and "which camp are they working on
// right now" lives here, backed by localStorage. Every other page/script
// reads through these functions instead of touching localStorage directly.

const TOKEN_KEY = "vitera_token";
const USER_KEY = "vitera_user";
const CAMP_KEY = "vitera_camp"; // { id, camp_code, camp_date }

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function isLoggedIn() {
  return !!getToken();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // deliberately NOT clearing the selected camp -- if the same volunteer
  // logs back in during the same camp day, no need to re-pick it.
}

export function logout() {
  clearSession();
  window.location.href = "login.html";
}

// ---------- active camp (picked on the dashboard, used by every stall page) ----------
export function saveCamp(camp) {
  localStorage.setItem(CAMP_KEY, JSON.stringify(camp));
}

export function getCamp() {
  const raw = localStorage.getItem(CAMP_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearCamp() {
  localStorage.removeItem(CAMP_KEY);
}

// ---------- route guards ----------
// Call at the top of every protected page. Redirects to login if not
// signed in. If allowedRoles is given and the user's role isn't in it,
// sends them back to the dashboard instead of showing the page.
export function requireAuth(allowedRoles) {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return null;
  }
  const user = getUser();
  if (allowedRoles && user.role !== "ADMIN" && !allowedRoles.includes(user.role)) {
    window.location.href = "dashboard.html";
    return null;
  }
  return user;
}

// Call at the top of any stall page -- redirects to the dashboard with a
// hint if no camp has been selected yet.
export function requireCamp() {
  const camp = getCamp();
  if (!camp) {
    window.location.href = "dashboard.html";
    return null;
  }
  return camp;
}

export const ROLE_LABELS = {
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  VOLUNTEER: "Volunteer",
  COORDINATOR: "Coordinator",
};