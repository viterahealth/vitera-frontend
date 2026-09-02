import { apiGet, apiPatch, apiPost, downloadFile, setupPatientSearch, showToast, formatStatus } from "./api.js";
import { requireAuth, requireCamp, logout } from "./session.js";

requireAuth(["DOCTOR", "ADMIN"]);
const camp = requireCamp();

document.getElementById("logout-btn").addEventListener("click", logout);

const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const patientSection = document.getElementById("patient-section");
const saveBtn = document.getElementById("save-consult-btn");
const newRxBlock = document.getElementById("new-rx-block");
const existingRxBlock = document.getElementById("existing-rx-block");
const newRxRows = document.getElementById("new-rx-rows");
const existingRxList = document.getElementById("existing-rx-list");
const downloadPdfBtn = document.getElementById("download-pdf-btn");

let selected = null;
let mode = "create"; // "create" -> POST, "update" -> PATCH

// ---------- small helpers ----------
const val = (id) => {
  const v = document.getElementById(id).value.trim();
  return v === "" ? null : v;
};
const setVal = (id, v) => { document.getElementById(id).value = v ?? ""; };

function resetConsultFields() {
  ["chief_complaint", "clinical_observations", "diagnosis", "doctor_notes", "recommendations"].forEach(
    (id) => setVal(id, "")
  );
}

// ---------- vitals / history read-only summaries ----------
async function loadVitalsSummary(registrationId) {
  const el = document.getElementById("vitals-summary");
  try {
    const v = await apiGet(`/camps/${camp.id}/registrations/${registrationId}/vitals`);
    const parts = [];
    if (v.height_cm || v.weight_kg) {
      parts.push(
        `<div class="summary-item"><div class="label">Height / Weight</div><div class="value">${
          v.height_cm ?? "—"
        } cm / ${v.weight_kg ?? "—"} kg</div></div>`
      );
    }
    if (v.bmi) {
      parts.push(`<div class="summary-item"><div class="label">BMI</div><div class="value">${v.bmi}</div></div>`);
    }
    if (v.systolic_bp || v.diastolic_bp) {
      parts.push(
        `<div class="summary-item"><div class="label">Blood Pressure</div><div class="value">${
          v.systolic_bp ?? "—"
        }/${v.diastolic_bp ?? "—"}</div></div>`
      );
    }
    if (v.blood_sugar) {
      parts.push(
        `<div class="summary-item"><div class="label">Blood Sugar</div><div class="value">${v.blood_sugar} (${
          v.blood_sugar_type || "—"
        })</div></div>`
      );
    }
    if (v.temperature_celsius) {
      parts.push(
        `<div class="summary-item"><div class="label">Temperature</div><div class="value">${v.temperature_celsius}&deg;C</div></div>`
      );
    }
    el.innerHTML = parts.length
      ? `<div class="summary-grid">${parts.join("")}</div>`
      : `<span class="summary-note">Recorded, but no values entered yet.</span>`;
  } catch {
    el.textContent = "No vitals recorded yet.";
  }
}

async function loadHistorySummary(registrationId) {
  const el = document.getElementById("history-summary");
  try {
    const h = await apiGet(`/camps/${camp.id}/registrations/${registrationId}/medical-history`);
    const conditions = [
      ["has_diabetes", "Diabetes"],
      ["has_hypertension", "Hypertension"],
      ["has_tb", "TB"],
      ["has_asthma_copd", "Asthma/COPD"],
      ["has_cardiac_disease", "Cardiac disease"],
      ["has_renal_disease", "Renal disease"],
      ["has_liver_disease", "Liver disease"],
    ]
      .filter(([key]) => h[key])
      .map(([, label]) => label);

    let html = "";
    if (h.chief_complaint) {
      html += `<p style="margin:6px 0;"><strong>Complaint:</strong> ${h.chief_complaint}</p>`;
    }
    if (conditions.length) {
      html += `<p style="margin:6px 0;"><strong>Known conditions:</strong> ${conditions.join(", ")}</p>`;
    }
    if (h.allergies) {
      html += `<p style="margin:6px 0;"><strong>Allergies:</strong> ${h.allergies}</p>`;
    }
    if (h.existing_conditions) {
      html += `<p style="margin:6px 0;"><strong>Existing conditions:</strong> ${h.existing_conditions}</p>`;
    }
    if (h.current_medications) {
      html += `<p style="margin:6px 0;"><strong>Current medications:</strong> ${h.current_medications}</p>`;
    }
    el.innerHTML = html || `<span class="summary-note">Recorded, but no notable fields entered.</span>`;
  } catch {
    el.textContent = "No history recorded yet.";
  }
}

// ---------- new-consultation prescription row builder ----------
function addNewRxRow() {
  const row = document.createElement("div");
  row.className = "rx-row";
  row.innerHTML = `
    <div><label style="margin-top:0;">Medicine</label><input type="text" class="rx-name"></div>
    <div><label style="margin-top:0;">Dosage</label><input type="text" class="rx-dosage"></div>
    <div><label style="margin-top:0;">Frequency</label><input type="text" class="rx-frequency"></div>
    <div><label style="margin-top:0;">Duration</label><input type="text" class="rx-duration"></div>
    <button type="button" class="rx-remove">&times;</button>
  `;
  row.querySelector(".rx-remove").addEventListener("click", () => row.remove());
  newRxRows.appendChild(row);
}

function collectNewRxRows() {
  return [...newRxRows.querySelectorAll(".rx-row")]
    .map((row) => ({
      medicine_name: row.querySelector(".rx-name").value.trim(),
      dosage: row.querySelector(".rx-dosage").value.trim() || null,
      frequency: row.querySelector(".rx-frequency").value.trim() || null,
      duration: row.querySelector(".rx-duration").value.trim() || null,
    }))
    .filter((rx) => rx.medicine_name !== "");
}

function renderExistingRx(prescriptions) {
  existingRxList.innerHTML = prescriptions.length
    ? prescriptions
        .map(
          (p) => `
      <div class="rx-existing">
        <span class="rx-name">${p.medicine_name}</span>
        <span class="rx-detail">${[p.dosage, p.frequency, p.duration].filter(Boolean).join(" · ") || "—"}</span>
      </div>`
        )
        .join("")
    : `<p class="summary-note">No medicines added yet.</p>`;
}

// ---------- load consultation (create vs update mode) ----------
async function loadConsultation(registrationId) {
  resetConsultFields();
  newRxRows.innerHTML = "";

  try {
    const c = await apiGet(`/camps/${camp.id}/registrations/${registrationId}/consultation`);
    mode = "update";
    setVal("chief_complaint", c.chief_complaint);
    setVal("clinical_observations", c.clinical_observations);
    setVal("diagnosis", c.diagnosis);
    setVal("doctor_notes", c.doctor_notes);
    setVal("recommendations", c.recommendations);
    renderExistingRx(c.prescriptions);

    newRxBlock.classList.add("hidden");
    existingRxBlock.classList.remove("hidden");
    downloadPdfBtn.classList.remove("hidden");
    saveBtn.textContent = "Save Changes";
    document.getElementById("consult-heading").textContent = `Consultation — by ${c.doctor_name}`;
  } catch {
    mode = "create";
    addNewRxRow();

    newRxBlock.classList.remove("hidden");
    existingRxBlock.classList.add("hidden");
    downloadPdfBtn.classList.add("hidden");
    saveBtn.textContent = "Save Consultation";
    document.getElementById("consult-heading").textContent = "Consultation";
  }
}

// ---------- wire up search ----------
if (camp) {
  setupPatientSearch(camp.id, searchInput, searchResults, async (result) => {
    selected = result;
    document.getElementById("p-name").textContent = result.patient_name;
    document.getElementById("p-meta").textContent = `${result.registration_code} · ${
      result.phone || "no phone"
    }`;
    document.getElementById("p-status").textContent = formatStatus(result.status);
    patientSection.classList.remove("hidden");

    document.getElementById("vitals-summary").textContent = "Loading…";
    document.getElementById("history-summary").textContent = "Loading…";

    loadVitalsSummary(result.registration_id);
    loadHistorySummary(result.registration_id);
    await loadConsultation(result.registration_id);

    patientSection.scrollIntoView({ behavior: "smooth" });
  });
}

document.getElementById("add-rx-row-btn").addEventListener("click", addNewRxRow);

// ---------- add one medicine to an already-existing consultation ----------
document.getElementById("add-rx-btn").addEventListener("click", async () => {
  if (!selected) return;
  const medicine_name = document.getElementById("add-rx-name").value.trim();
  if (!medicine_name) {
    showToast("Enter a medicine name first", true);
    return;
  }
  const payload = {
    medicine_name,
    dosage: document.getElementById("add-rx-dosage").value.trim() || null,
    frequency: document.getElementById("add-rx-frequency").value.trim() || null,
    duration: document.getElementById("add-rx-duration").value.trim() || null,
  };
  try {
    const c = await apiPost(
      `/camps/${camp.id}/registrations/${selected.registration_id}/consultation/prescriptions`,
      payload
    );
    renderExistingRx(c.prescriptions);
    ["add-rx-name", "add-rx-dosage", "add-rx-frequency", "add-rx-duration"].forEach(
      (id) => (document.getElementById(id).value = "")
    );
    showToast("Medicine added");
  } catch (e) {
    showToast(e.message, true);
  }
});

// ---------- download the letterhead prescription PDF ----------
downloadPdfBtn.addEventListener("click", async () => {
  if (!selected) return;
  downloadPdfBtn.disabled = true;
  downloadPdfBtn.textContent = "Generating…";
  try {
    await downloadFile(
      `/camps/${camp.id}/registrations/${selected.registration_id}/consultation/pdf`,
      `consultation_${selected.registration_code}.pdf`
    );
  } catch (e) {
    showToast(e.message, true);
  } finally {
    downloadPdfBtn.disabled = false;
    downloadPdfBtn.textContent = "Download Prescription PDF";
  }
});

// ---------- save consultation (create or update) ----------
saveBtn.addEventListener("click", async () => {
  if (!selected) return;
  saveBtn.disabled = true;

  try {
    if (mode === "create") {
      const payload = {
        chief_complaint: val("chief_complaint"),
        clinical_observations: val("clinical_observations"),
        diagnosis: val("diagnosis"),
        doctor_notes: val("doctor_notes"),
        recommendations: val("recommendations"),
        prescriptions: collectNewRxRows(),
      };
      await apiPost(`/camps/${camp.id}/registrations/${selected.registration_id}/consultation`, payload);
      showToast(`Consultation recorded for ${selected.patient_name}`);
    } else {
      const payload = {
        chief_complaint: val("chief_complaint"),
        clinical_observations: val("clinical_observations"),
        diagnosis: val("diagnosis"),
        doctor_notes: val("doctor_notes"),
        recommendations: val("recommendations"),
      };
      await apiPatch(`/camps/${camp.id}/registrations/${selected.registration_id}/consultation`, payload);
      showToast(`Consultation updated for ${selected.patient_name}`);
    }
    await loadConsultation(selected.registration_id);
  } catch (e) {
    showToast(e.message, true);
  } finally {
    saveBtn.disabled = false;
  }
});