import { apiGet, showToast } from "./api.js";
import { requireAuth, getUser, getCamp, saveCamp, logout, ROLE_LABELS } from "./session.js";

const user = requireAuth(); // any logged-in role can see the dashboard
if (user) {
  document.getElementById("user-name").textContent = user.name;
  document.getElementById("role-badge").textContent = ROLE_LABELS[user.role] || user.role;
}

document.getElementById("logout-btn").addEventListener("click", logout);

// Roles that see every stall button regardless of each action's own
// `roles` list below — ADMIN and DOCTOR have full parity.
const FULL_ACCESS_ROLES = ["ADMIN", "DOCTOR"];

// ---------- camp picker ----------
const campSelect = document.getElementById("camp-select");
const campEmptyHint = document.getElementById("camp-empty-hint");

let camps = [];

async function loadCamps() {
  try {
    camps = await apiGet("/camps");
  } catch (e) {
    showToast(e.message, true);
    campSelect.innerHTML = `<option value="">Couldn't load camps</option>`;
    return;
  }

  if (!camps.length) {
    campSelect.innerHTML = `<option value="">No camps yet</option>`;
    campEmptyHint.classList.remove("hidden");
    return;
  }

  const saved = getCamp();
  campSelect.innerHTML = camps
    .map((c) => `<option value="${c.id}">${c.camp_code} — ${c.camp_date}</option>`)
    .join("");

  const stillValid = saved && camps.some((c) => c.id === saved.id);
  const initial = stillValid ? saved.id : camps[0].id;
  campSelect.value = initial;
  applySelectedCamp(initial);
}

function applySelectedCamp(campId) {
  const camp = camps.find((c) => c.id === campId);
  if (!camp) return;
  saveCamp({ id: camp.id, camp_code: camp.camp_code, camp_date: camp.camp_date });
}

campSelect.addEventListener("change", () => applySelectedCamp(campSelect.value));

// ---------- global patient search (every camp, every visit) ----------
// Unlike the per-camp registration search used on the stall pages, this
// hits GET /patients/search directly, so it isn't scoped to the
// currently-selected camp and works even before a camp is picked.
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
let debounceTimer;

function renderPatientResults(patients) {
  searchResults.innerHTML = "";
  if (!patients.length) {
    searchResults.innerHTML = `<div class="empty-hint">No matches yet.</div>`;
    return;
  }
  patients.forEach((p) => {
    const row = document.createElement("div");
    row.className = "result-row";
    row.innerHTML = `
      <div>
        <div class="name">${p.name}</div>
        <div class="meta">${p.patient_code} &middot; ${p.phone || "no phone"}${
      p.family_code ? " &middot; Family " + p.family_code : ""
    }</div>
      </div>
      <span>&rarr;</span>
    `;
    row.addEventListener("click", () => {
      window.location.href = `patient-detail.html?id=${encodeURIComponent(p.id)}`;
    });
    searchResults.appendChild(row);
  });
}

searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) {
    searchResults.innerHTML = "";
    return;
  }
  debounceTimer = setTimeout(async () => {
    try {
      const patients = await apiGet(`/patients/search?q=${encodeURIComponent(q)}`);
      renderPatientResults(patients);
    } catch (e) {
      showToast(e.message, true);
    }
  }, 250);
});

// ---------- stall buttons, filtered by role ----------
const STALL_ACTIONS = [
  {
    title: "Create Patient",
    desc: "Register a new walk-in patient",
    href: "register.html",
    roles: ["VOLUNTEER", "COORDINATOR"],
  },
  {
    title: "Check-In",
    desc: "Mark a pre-registered patient as arrived",
    href: "checkin.html",
    roles: ["VOLUNTEER", "COORDINATOR"],
  },
  {
    title: "Height & Weight",
    desc: "Stall 2 — vitals",
    href: "vitals-height-weight.html",
    roles: ["VOLUNTEER", "COORDINATOR"],
  },
  {
    title: "Clinical Vitals",
    desc: "Stall 3 — BP, sugar, bone density",
    href: "vitals-clinical.html",
    roles: ["VOLUNTEER", "COORDINATOR"],
  },
  {
    title: "Medical History",
    desc: "Stall 4 — history taking",
    href: "medical-history.html",
    roles: ["VOLUNTEER", "COORDINATOR"],
  },
  {
    title: "Consultation",
    desc: "Stall 5 — diagnosis & prescription",
    href: "consultation.html",
    roles: ["DOCTOR"],
  },
];

function renderStallGrid() {
  const grid = document.getElementById("stall-grid");
  const visible = STALL_ACTIONS.filter(
    (a) => FULL_ACCESS_ROLES.includes(user.role) || a.roles.includes(user.role)
  );

  if (!visible.length) {
    grid.innerHTML = `<div class="empty-hint">No actions available for your role yet.</div>`;
    return;
  }

  grid.innerHTML = visible
    .map(
      (a) => `
      <a class="stall-card" href="${a.href}">
        <div class="stall-title">${a.title}</div>
        <div class="stall-desc">${a.desc}</div>
      </a>`
    )
    .join("");
}

if (user) {
  renderStallGrid();
  loadCamps();
}