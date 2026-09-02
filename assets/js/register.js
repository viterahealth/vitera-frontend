import { apiPost, showToast } from "./api.js";
import { requireAuth, requireCamp, logout } from "./session.js";

requireAuth(["VOLUNTEER", "COORDINATOR", "DOCTOR"]);
const camp = requireCamp();

document.getElementById("logout-btn").addEventListener("click", logout);

const slotSelect = document.getElementById("slot-select");
const memberRows = document.getElementById("member-rows");
const registerBtn = document.getElementById("register-btn");
const resultBlock = document.getElementById("result-block");

// ---------- slots ----------
// Static hourly slots, 8 AM to 1 PM. These strings must visually match
// what the backend's _slot_label() produces for the camp's actual
// camp_slots rows (registrations_services.py), since matching is by
// text, not slot_id. If a camp's real slot times ever differ from this
// list, matching silently fails with "No slot matching ... found for
// this camp" -- keep this list in sync whenever a camp's schedule changes.
const CAMP_SLOTS = [
  "8:00 AM-9:00 AM",
  "9:00 AM-10:00 AM",
  "10:00 AM-11:00 AM",
  "11:00 AM-12:00 PM",
  "12:00 PM-1:00 PM",
];

function loadSlots() {
  slotSelect.innerHTML = CAMP_SLOTS.map((label) => `<option value="${label}">${label}</option>`).join("");
}

// ---------- member rows ----------
function addMemberRow() {
  const row = document.createElement("div");
  row.className = "member-row";
  row.innerHTML = `
    <div class="member-name-row">
      <label>Name</label>
      <input type="text" class="m-name" required>
    </div>
    <div class="member-details-row">
      <div><label>Phone</label><input type="text" class="m-phone"></div>
      <div>
        <label>Gender</label>
        <select class="m-gender">
          <option value="">—</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div><label>DOB / Age</label><input type="text" class="m-dob" placeholder="DD-MM-YYYY or age"></div>
      <button type="button" class="member-remove" title="Remove this member">&times;</button>
    </div>
  `;
  row.querySelector(".member-remove").addEventListener("click", () => {
    // keep at least one row -- can't submit with zero members
    if (memberRows.children.length > 1) row.remove();
  });
  memberRows.appendChild(row);
}

function collectMembers() {
  return [...memberRows.querySelectorAll(".member-row")]
    .map((row) => ({
      name: row.querySelector(".m-name").value.trim(),
      phone: row.querySelector(".m-phone").value.trim() || null,
      gender: row.querySelector(".m-gender").value || null,
      // free text now -- backend's _normalize_dob_or_age accepts either
      // a real date (DD-MM-YYYY / YYYY-MM-DD / DD/MM/YYYY) or a plain age
      date_of_birth: row.querySelector(".m-dob").value.trim() || null,
    }))
    .filter((m) => m.name !== "");
}

document.getElementById("add-member-btn").addEventListener("click", addMemberRow);

// ---------- submit ----------
registerBtn.addEventListener("click", async () => {
  const members = collectMembers();
  if (!members.length) {
    showToast("Add at least one member with a name", true);
    return;
  }
  const slot = slotSelect.value;
  if (!slot) {
    showToast("Pick a slot first", true);
    return;
  }
  // email is optional now -- backend schema treats it as nullable
  const email = document.getElementById("email").value.trim() || null;

  const payload = {
    slot,
    email,
    members,
    "Flat Number": document.getElementById("flat_number").value.trim() || null,
    service_interest: document.getElementById("service_interest").value.trim() || null,
  };

  registerBtn.disabled = true;
  try {
    const data = await apiPost(`/camps/${camp.id}/registrations`, payload);
    showToast(`Registered ${data.members.length} member(s)`);
    resultBlock.classList.remove("hidden");
    resultBlock.innerHTML = data.members
      .map(
        (m) => `
      <div class="rx-existing">
        <span class="rx-name">${m.name}</span>
        <span class="rx-detail">${m.registration_code}</span>
      </div>`
      )
      .join("");

    // reset the form for the next family, but keep the same slot picked
    // since the same volunteer is likely still working that slot
    memberRows.innerHTML = "";
    addMemberRow();
    document.getElementById("email").value = "";
    document.getElementById("flat_number").value = "";
    document.getElementById("service_interest").value = "";
  } catch (e) {
    showToast(e.message, true);
  } finally {
    registerBtn.disabled = false;
  }
});

if (camp) {
  loadSlots();
  addMemberRow();
}