import { apiGet, downloadFile, showToast, formatStatus } from "./api.js";
import { requireAuth, logout } from "./session.js";

requireAuth(); // any logged-in role can view a patient's full record

document.getElementById("logout-btn").addEventListener("click", logout);

const params = new URLSearchParams(window.location.search);
const PATIENT_ID = params.get("id");

const summaryCard = document.getElementById("patient-summary-card");
const visitsContainer = document.getElementById("visits-container");

function renderVitals(v) {
  if (!v) return `<p class="summary-note">No vitals recorded for this visit.</p>`;
  const items = [];
  if (v.height_cm || v.weight_kg) {
    items.push(`<div class="summary-item"><div class="label">Height / Weight</div><div class="value">${v.height_cm ?? "—"} cm / ${v.weight_kg ?? "—"} kg</div></div>`);
  }
  if (v.bmi) items.push(`<div class="summary-item"><div class="label">BMI</div><div class="value">${v.bmi}</div></div>`);
  if (v.systolic_bp || v.diastolic_bp) {
    items.push(`<div class="summary-item"><div class="label">Blood Pressure</div><div class="value">${v.systolic_bp ?? "—"}/${v.diastolic_bp ?? "—"}</div></div>`);
  }
  if (v.blood_sugar) {
    items.push(`<div class="summary-item"><div class="label">Blood Sugar</div><div class="value">${v.blood_sugar} (${v.blood_sugar_type || "—"})</div></div>`);
  }
  if (v.temperature_celsius) {
    items.push(`<div class="summary-item"><div class="label">Temperature</div><div class="value">${v.temperature_celsius}&deg;C</div></div>`);
  }
  if (v.bone_density_bmd) {
    items.push(`<div class="summary-item"><div class="label">Bone Density</div><div class="value">${v.bone_density_bmd} (${v.bone_density_site || "—"})</div></div>`);
  }
  return items.length
    ? `<div class="summary-grid">${items.join("")}</div>`
    : `<p class="summary-note">Recorded, but no values entered yet.</p>`;
}

function renderConsultation(c) {
  if (!c) return `<p class="summary-note">No consultation recorded for this visit.</p>`;
  const rx = c.prescriptions && c.prescriptions.length
    ? c.prescriptions
        .map(
          (p) => `
      <div class="rx-existing">
        <span class="rx-name">${p.medicine_name}</span>
        <span class="rx-detail">${[p.dosage, p.frequency, p.duration].filter(Boolean).join(" · ") || "—"}</span>
      </div>`
        )
        .join("")
    : `<p class="summary-note">No medicines prescribed.</p>`;

  return `
    <p style="margin:6px 0;"><strong>Doctor:</strong> ${c.doctor_name}</p>
    ${c.diagnosis ? `<p style="margin:6px 0;"><strong>Diagnosis:</strong> ${c.diagnosis}</p>` : ""}
    ${c.recommendations ? `<p style="margin:6px 0;"><strong>Recommendations:</strong> ${c.recommendations}</p>` : ""}
    <h3 style="margin-top:14px; font-size:0.95rem;">Prescriptions</h3>
    ${rx}
  `;
}

function renderVisit(patientId, reg) {
  const card = document.createElement("div");
  card.className = "card visit-card";
  card.innerHTML = `
    <div class="visit-card-header">
      <div>
        <strong>${reg.camp_code || "Camp"}</strong>${reg.camp_date ? " — " + reg.camp_date : ""}
        <div class="code">${reg.registration_code}${reg.slot_label ? " · " + reg.slot_label : ""}</div>
      </div>
      <span class="status-pill">${formatStatus(reg.status)}</span>
    </div>

    <h3 style="font-size:0.9rem; margin-top:12px;">Vitals</h3>
    ${renderVitals(reg.vitals)}

    <h3 style="font-size:0.9rem; margin-top:14px;">Consultation</h3>
    ${renderConsultation(reg.consultation)}

    <button type="button" class="btn btn-outline btn-block download-pdf-btn" style="margin-top:14px;">
      Download PDF
    </button>
  `;

  card.querySelector(".download-pdf-btn").addEventListener("click", async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = "Generating…";
    try {
      await downloadFile(
        `/patients/${patientId}/registrations/${reg.registration_id}/report.pdf`,
        `report_${reg.registration_code}.pdf`
      );
    } catch (err) {
      showToast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Download PDF";
    }
  });

  return card;
}

async function loadPatient() {
  if (!PATIENT_ID) {
    summaryCard.innerHTML = `<p class="subtitle">No patient specified.</p>`;
    return;
  }

  try {
    const p = await apiGet(`/patients/${PATIENT_ID}`);

    summaryCard.innerHTML = `
      <div class="patient-header">
        <div>
          <h2 style="color:var(--vt-text); margin-bottom:2px;">${p.name}</h2>
          <div class="code">${p.patient_code}${p.family_code ? " · Family " + p.family_code : ""}</div>
        </div>
      </div>
      <div class="summary-grid" style="margin-top:14px;">
        <div class="summary-item"><div class="label">Phone</div><div class="value">${p.phone || "—"}</div></div>
        <div class="summary-item"><div class="label">Email</div><div class="value">${p.email || "—"}</div></div>
        <div class="summary-item"><div class="label">Gender</div><div class="value">${p.gender || "—"}</div></div>
        <div class="summary-item"><div class="label">DOB / Age</div><div class="value">${p.dob_or_age || "—"}</div></div>
      </div>
      ${p.address ? `<p class="summary-note" style="margin-top:10px;">${p.address}</p>` : ""}
    `;

    if (!p.registrations.length) {
      visitsContainer.innerHTML = `<div class="card"><p class="empty-hint">No camp visits recorded yet.</p></div>`;
      return;
    }

    visitsContainer.innerHTML = "";
    p.registrations.forEach((reg) => visitsContainer.appendChild(renderVisit(p.id, reg)));
  } catch (e) {
    summaryCard.innerHTML = `<p class="subtitle">Couldn't load this patient.</p>`;
    showToast(e.message, true);
  }
}

loadPatient();