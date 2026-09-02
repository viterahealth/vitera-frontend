import { apiGet, apiPatch, apiPost, setupPatientSearch, showToast, formatStatus } from "./api.js";
import { requireAuth, requireCamp, logout } from "./session.js";

requireAuth(["VOLUNTEER", "COORDINATOR"]);
const camp = requireCamp();

document.getElementById("logout-btn").addEventListener("click", logout);

const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const formCard = document.getElementById("form-card");
const form = document.getElementById("history-form");
const saveBtn = document.getElementById("save-btn");

let selected = null;
let mode = "create"; // "create" -> POST, "update" -> PATCH

// ---------- small DOM helpers ----------
const val = (id) => {
  const v = document.getElementById(id).value.trim();
  return v === "" ? null : v;
};
const num = (id) => {
  const v = document.getElementById(id).value;
  return v === "" ? null : Number(v);
};
const checked = (id) => document.getElementById(id).checked;
const setVal = (id, v) => { document.getElementById(id).value = v ?? ""; };
const setChecked = (id, v) => { document.getElementById(id).checked = !!v; };

// returns null if every value in the object is null/empty -- keeps
// irrelevant sections (e.g. menstrual/obstetric for a male patient) out
// of the stored JSON entirely instead of saving a blob of nulls
function nullIfEmpty(obj) {
  const hasValue = Object.values(obj).some((v) => v !== null && v !== undefined && v !== "");
  return hasValue ? obj : null;
}

function buildPayload() {
  return {
    chief_complaint: val("chief_complaint"),
    has_diabetes: checked("has_diabetes"),
    has_hypertension: checked("has_hypertension"),
    has_tb: checked("has_tb"),
    has_asthma_copd: checked("has_asthma_copd"),
    has_cardiac_disease: checked("has_cardiac_disease"),
    has_renal_disease: checked("has_renal_disease"),
    has_liver_disease: checked("has_liver_disease"),
    other_major_illnesses: val("other_major_illnesses"),
    existing_conditions: val("existing_conditions"),
    current_medications: val("current_medications"),
    allergies: val("allergies"),
    past_surgeries: val("past_surgeries"),
    family_history: val("family_history"),
    lifestyle_notes: val("lifestyle_notes"),
    past_history_details: nullIfEmpty({
      previous_similar_illness: val("ph_previous_similar_illness"),
      hospitalizations: val("ph_hospitalizations"),
      transfusions: val("ph_transfusions"),
      trauma: val("ph_trauma"),
      psychiatric_history: val("ph_psychiatric_history"),
    }),
    drug_allergy_details: nullIfEmpty({
      recent_medications: val("da_recent_medications"),
      dose_duration: val("da_dose_duration"),
      compliance: val("da_compliance"),
      otc_herbal: val("da_otc_herbal"),
      allergy_reaction_details: val("da_allergy_reaction_details"),
    }),
    personal_history: nullIfEmpty({
      diet: val("pe_diet"),
      appetite: val("pe_appetite"),
      sleep: val("pe_sleep"),
      bowel_bladder: val("pe_bowel_bladder"),
      smoking: val("pe_smoking"),
      alcohol: val("pe_alcohol"),
      other_substance_use: val("pe_other_substance_use"),
      occupation: val("pe_occupation"),
      occupational_exposure: val("pe_occupational_exposure"),
      activity: val("pe_activity"),
      sexual_history: val("pe_sexual_history"),
    }),
    social_environmental: nullIfEmpty({
      living_conditions: val("se_living_conditions"),
      housing: val("se_housing"),
      sanitation: val("se_sanitation"),
      travel: val("se_travel"),
      sick_contacts: val("se_sick_contacts"),
      pets: val("se_pets"),
      socioeconomic: val("se_socioeconomic"),
    }),
    menstrual_obstetric: nullIfEmpty({
      menarche_age: num("mo_menarche_age"),
      last_menstrual_period: val("mo_last_menstrual_period"),
      cycle_regularity: val("mo_cycle_regularity"),
      bleeding_duration_and_amount: val("mo_bleeding_duration_and_amount"),
      dysmenorrhea: checked("mo_dysmenorrhea"),
      menopause: checked("mo_menopause"),
      gravida: num("mo_gravida"),
      para: num("mo_para"),
      abortions: num("mo_abortions"),
      living_children: num("mo_living_children"),
      previous_pregnancy_outcomes: val("mo_previous_pregnancy_outcomes"),
      pregnancy_complications: val("mo_pregnancy_complications"),
      contraception: val("mo_contraception"),
      complaints: val("mo_complaints"),
    }),
  };
}

function resetForm() {
  form.reset();
}

function prefillForm(d) {
  setVal("chief_complaint", d.chief_complaint);
  setChecked("has_diabetes", d.has_diabetes);
  setChecked("has_hypertension", d.has_hypertension);
  setChecked("has_tb", d.has_tb);
  setChecked("has_asthma_copd", d.has_asthma_copd);
  setChecked("has_cardiac_disease", d.has_cardiac_disease);
  setChecked("has_renal_disease", d.has_renal_disease);
  setChecked("has_liver_disease", d.has_liver_disease);
  setVal("other_major_illnesses", d.other_major_illnesses);
  setVal("existing_conditions", d.existing_conditions);
  setVal("current_medications", d.current_medications);
  setVal("allergies", d.allergies);
  setVal("past_surgeries", d.past_surgeries);
  setVal("family_history", d.family_history);
  setVal("lifestyle_notes", d.lifestyle_notes);

  const ph = d.past_history_details || {};
  setVal("ph_previous_similar_illness", ph.previous_similar_illness);
  setVal("ph_hospitalizations", ph.hospitalizations);
  setVal("ph_transfusions", ph.transfusions);
  setVal("ph_trauma", ph.trauma);
  setVal("ph_psychiatric_history", ph.psychiatric_history);

  const da = d.drug_allergy_details || {};
  setVal("da_recent_medications", da.recent_medications);
  setVal("da_dose_duration", da.dose_duration);
  setVal("da_compliance", da.compliance);
  setVal("da_otc_herbal", da.otc_herbal);
  setVal("da_allergy_reaction_details", da.allergy_reaction_details);

  const pe = d.personal_history || {};
  setVal("pe_diet", pe.diet);
  setVal("pe_appetite", pe.appetite);
  setVal("pe_sleep", pe.sleep);
  setVal("pe_bowel_bladder", pe.bowel_bladder);
  setVal("pe_smoking", pe.smoking);
  setVal("pe_alcohol", pe.alcohol);
  setVal("pe_other_substance_use", pe.other_substance_use);
  setVal("pe_occupation", pe.occupation);
  setVal("pe_occupational_exposure", pe.occupational_exposure);
  setVal("pe_activity", pe.activity);
  setVal("pe_sexual_history", pe.sexual_history);

  const se = d.social_environmental || {};
  setVal("se_living_conditions", se.living_conditions);
  setVal("se_housing", se.housing);
  setVal("se_sanitation", se.sanitation);
  setVal("se_travel", se.travel);
  setVal("se_sick_contacts", se.sick_contacts);
  setVal("se_pets", se.pets);
  setVal("se_socioeconomic", se.socioeconomic);

  const mo = d.menstrual_obstetric || {};
  setVal("mo_menarche_age", mo.menarche_age);
  setVal("mo_last_menstrual_period", mo.last_menstrual_period);
  setVal("mo_cycle_regularity", mo.cycle_regularity);
  setVal("mo_bleeding_duration_and_amount", mo.bleeding_duration_and_amount);
  setChecked("mo_dysmenorrhea", mo.dysmenorrhea);
  setChecked("mo_menopause", mo.menopause);
  setVal("mo_gravida", mo.gravida);
  setVal("mo_para", mo.para);
  setVal("mo_abortions", mo.abortions);
  setVal("mo_living_children", mo.living_children);
  setVal("mo_previous_pregnancy_outcomes", mo.previous_pregnancy_outcomes);
  setVal("mo_pregnancy_complications", mo.pregnancy_complications);
  setVal("mo_contraception", mo.contraception);
  setVal("mo_complaints", mo.complaints);
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
    resetForm();

    try {
      const existing = await apiGet(
        `/camps/${camp.id}/registrations/${result.registration_id}/medical-history`
      );
      prefillForm(existing);
      mode = "update";
      saveBtn.textContent = "Update Medical History";
    } catch {
      // no history recorded yet -- blank form, next save creates it
      mode = "create";
      saveBtn.textContent = "Save Medical History";
    }

    formCard.scrollIntoView({ behavior: "smooth" });
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selected) return;

  saveBtn.disabled = true;
  const payload = buildPayload();

  try {
    if (mode === "create") {
      await apiPost(`/camps/${camp.id}/registrations/${selected.registration_id}/medical-history`, payload);
    } else {
      await apiPatch(`/camps/${camp.id}/registrations/${selected.registration_id}/medical-history`, payload);
    }
    showToast(`Medical history saved for ${selected.patient_name}`);
    mode = "update";
    saveBtn.textContent = "Update Medical History";
  } catch (err) {
    showToast(err.message, true);
  } finally {
    saveBtn.disabled = false;
  }
});