import { apiGet, apiPut, setupPatientSearch, showToast, formatStatus } from "./api.js";
import { requireAuth, requireCamp, logout } from "./session.js";

requireAuth(["VOLUNTEER", "COORDINATOR"]);
const camp = requireCamp();

document.getElementById("logout-btn").addEventListener("click", logout);

const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const formCard = document.getElementById("form-card");
const saveBtn = document.getElementById("save-btn");

let selected = null;

const numVal = (id) => {
  const v = document.getElementById(id).value;
  return v === "" ? null : Number(v);
};
const val = (id) => {
  const v = document.getElementById(id).value.trim();
  return v === "" ? null : v;
};
const setVal = (id, v) => {
  document.getElementById(id).value = v ?? "";
};

function resetForm() {
  [
    "systolic_bp",
    "diastolic_bp",
    "blood_sugar",
    "blood_sugar_type",
    "temperature_celsius",
    "bone_density_bmd",
    "bone_density_site",
    "bone_density_t_score",
    "bone_density_z_score",
  ].forEach((id) => setVal(id, ""));
}

async function loadExisting(registrationId) {
  resetForm();
  try {
    const v = await apiGet(`/camps/${camp.id}/registrations/${registrationId}/vitals`);
    setVal("systolic_bp", v.systolic_bp);
    setVal("diastolic_bp", v.diastolic_bp);
    setVal("blood_sugar", v.blood_sugar);
    setVal("blood_sugar_type", v.blood_sugar_type);
    setVal("temperature_celsius", v.temperature_celsius);
    setVal("bone_density_bmd", v.bone_density_bmd);
    setVal("bone_density_site", v.bone_density_site);
    setVal("bone_density_t_score", v.bone_density_t_score);
    setVal("bone_density_z_score", v.bone_density_z_score);
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
    systolic_bp: numVal("systolic_bp"),
    diastolic_bp: numVal("diastolic_bp"),
    blood_sugar: numVal("blood_sugar"),
    blood_sugar_type: val("blood_sugar_type"),
    temperature_celsius: numVal("temperature_celsius"),
    bone_density_bmd: numVal("bone_density_bmd"),
    bone_density_site: val("bone_density_site"),
    bone_density_t_score: numVal("bone_density_t_score"),
    bone_density_z_score: numVal("bone_density_z_score"),
  };

  try {
    await apiPut(`/camps/${camp.id}/registrations/${selected.registration_id}/vitals/screening`, payload);
    showToast(`Saved for ${selected.patient_name}`);
  } catch (e) {
    showToast(e.message, true);
  } finally {
    saveBtn.disabled = false;
  }
});