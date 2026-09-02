import { apiPatch, setupPatientSearch, showToast, formatStatus } from "./api.js";
import { requireAuth, requireCamp, logout } from "./session.js";

requireAuth(["VOLUNTEER", "COORDINATOR"]);
const camp = requireCamp();

document.getElementById("logout-btn").addEventListener("click", logout);

const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const patientCard = document.getElementById("patient-card");
const checkinBtn = document.getElementById("checkin-btn");

let selected = null;

if (camp) {
  setupPatientSearch(camp.id, searchInput, searchResults, (result) => {
    selected = result;
    document.getElementById("p-name").textContent = result.patient_name;
    document.getElementById("p-meta").textContent = `${result.registration_code} · ${
      result.phone || "no phone"
    }`;
    document.getElementById("p-status").textContent = formatStatus(result.status);
    patientCard.classList.remove("hidden");

    checkinBtn.disabled = result.status !== "REGISTERED";
    checkinBtn.textContent =
      result.status === "REGISTERED" ? "Mark as Checked In" : `Already: ${formatStatus(result.status)}`;

    patientCard.scrollIntoView({ behavior: "smooth" });
  });
}

checkinBtn.addEventListener("click", async () => {
  if (!selected) return;
  checkinBtn.disabled = true;
  try {
    await apiPatch(`/camps/${camp.id}/registrations/${selected.registration_id}/check-in`);
    showToast(`${selected.patient_name} checked in`);
    patientCard.classList.add("hidden");
    searchInput.value = "";
    searchResults.innerHTML = "";
    selected = null;
  } catch (e) {
    showToast(e.message, true);
    checkinBtn.disabled = false;
  }
});