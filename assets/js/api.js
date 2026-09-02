import { API_BASE_URL } from "./config.js";
import { getToken, clearSession } from "./session.js";

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearSession();
    window.location.href = "login.html";
    // stop the caller's .then chain from running with no data
    return new Promise(() => {});
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server returned an unexpected response (HTTP ${res.status})`);
  }

  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Request failed (HTTP ${res.status})`);
  }

  return json.data;
}

export const apiGet = (path) => request("GET", path);
export const apiPost = (path, body) => request("POST", path, body);
export const apiPut = (path, body) => request("PUT", path, body);
export const apiPatch = (path, body) => request("PATCH", path, body);
export const apiDelete = (path) => request("DELETE", path);

// ---------- toast ----------
export function showToast(message, isError) {
  let toast = document.getElementById("vt-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "vt-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = "toast show" + (isError ? " error" : "");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = "toast";
  }, 2800);
}

// ---------- shared patient search widget ----------
// Wires up a search <input> + results <div> against
// GET /camps/{campId}/registrations/search?q=... . Used identically by
// every stall page and by the dashboard.
//
// onSelect(result) fires when the volunteer taps a result row. `result`
// has: registration_id, registration_code, patient_id, patient_name,
// phone, status, slot_label
export function setupPatientSearch(campId, inputEl, resultsEl, onSelect) {
  let debounceTimer;

  inputEl.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = inputEl.value.trim();
    if (q.length < 2) {
      resultsEl.innerHTML = "";
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const results = await apiGet(
          `/camps/${campId}/registrations/search?q=${encodeURIComponent(q)}`
        );
        renderResults(results);
      } catch (e) {
        showToast(e.message, true);
      }
    }, 250);
  });

  function renderResults(results) {
    resultsEl.innerHTML = "";
    if (!results.length) {
      resultsEl.innerHTML = `<div class="empty-hint">No matches yet.</div>`;
      return;
    }
    results.forEach((r) => {
      const row = document.createElement("div");
      row.className = "result-row";
      row.innerHTML = `
        <div>
          <div class="name">${r.patient_name}</div>
          <div class="meta">${r.registration_code} &middot; ${r.phone || "no phone"}${
        r.slot_label ? " &middot; " + r.slot_label : ""
      }</div>
        </div>
        <span class="status-pill">${formatStatus(r.status)}</span>
      `;
      row.addEventListener("click", () => onSelect(r));
      resultsEl.appendChild(row);
    });
  }
}

export function formatStatus(status) {
  const labels = {
    REGISTERED: "Registered",
    CHECKED_IN: "Checked in",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NO_SHOW: "No show",
  };
  return labels[status] || status;
}

export async function downloadFile(path, filename) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { headers });

  if (res.status === 401) {
    clearSession();
    window.location.href = "login.html";
    return;
  }
  if (!res.ok) {
    let message = `Request failed (HTTP ${res.status})`;
    try {
      const json = await res.json();
      message = json.message || json.detail || message;
    } catch {
      /* response wasn't JSON -- keep default message */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}