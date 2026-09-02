import { apiGet, apiPut, setupPatientSearch, showToast, formatStatus } from "./api.js";
import { requireAuth, requireCamp, logout } from "./session.js";

requireAuth(["VOLUNTEER", "COORDINATOR"]);
const camp = requireCamp();

document.getElementById("logout-btn").addEventListener("click", logout);

const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const formCard = document.getElementById("form-card");
const saveBtn = document.getElementById("save-btn");
const bmiDisplay = document.getElementById("bmi-display");

let selected = null;

const numVal = (id) => {
  const v = document.getElementById(id).value;
  return v === "" ? null : Number(v);
};
const setVal = (id, v) => {
  document.getElementById(id).value = v ?? "";
};

function showBmi(bmi) {
  bmiDisplay.textContent = bmi ? `BMI: ${bmi}` : "BMI: —";
}

async function loadExisting(registrationId) {
  setVal("height_cm", "");
  setVal("weight_kg", "");
  showBmi(null);
  try {
    const v = await apiGet(`/camps/${camp.id}/registrations/${registrationId}/vitals`);
    setVal("height_cm", v.height_cm);
    setVal("weight_kg", v.weight_kg);
    showBmi(v.bmi);
  } catch {
    // no vitals recorded yet -- blank form, first save creates the row
  }
}

if (camp) {
  setupPatientSearch(camp.id, searchInput, searchResults, async (result) => {
    selected = result;
    document.getElementById("p-name").textContent = result.patient_name;
    document.getElementById("p-meta").textContent = `${result.registration_code} · ${
      result.phone || "no phone"
    }`;
    document.getElementById("p-status").textContent = formatStatus(result.status);
    formCard.classList.remove("hidden");

    await loadExisting(result.registration_id);
    formCard.scrollIntoView({ behavior: "smooth" });
  });
}

saveBtn.addEventListener("click", async () => {
  if (!selected) return;
  saveBtn.disabled = true;

  const payload = {
    height_cm: numVal("height_cm"),
    weight_kg: numVal("weight_kg"),
  };

  try {
    const v = await apiPut(
      `/camps/${camp.id}/registrations/${selected.registration_id}/vitals/basic`,
      payload
    );
    showBmi(v.bmi);
    showToast(`Saved for ${selected.patient_name}`);
  } catch (e) {
    showToast(e.message, true);
  } finally {
    saveBtn.disabled = false;
  }
});