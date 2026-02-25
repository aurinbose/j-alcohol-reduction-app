const STORAGE_KEY = "alcohol-reduction-log-v1";

const MILESTONES = [
  { id: "first-log", icon: "📝", title: "First Step", text: "Log your first entry", check: (stats) => stats.entryCount >= 1 },
  { id: "retro-log", icon: "🕒", title: "Time Traveler", text: "Add a retroactive entry", check: (stats) => stats.hasRetroactive },
  { id: "five-logs", icon: "🏅", title: "Consistency", text: "Log 5 entries", check: (stats) => stats.entryCount >= 5 },
  { id: "three-days", icon: "🏆", title: "Multi-day Tracker", text: "Track across 3 different days", check: (stats) => stats.dayCount >= 3 },
];

const form = document.querySelector("#entry-form");
const dateInput = document.querySelector("#entry-date");
const typeInput = document.querySelector("#entry-type");
const unitsInput = document.querySelector("#entry-units");
const notesInput = document.querySelector("#entry-notes");
const saveButton = document.querySelector("#save-button");
const cancelEditButton = document.querySelector("#cancel-edit");
const clearAllButton = document.querySelector("#clear-all");
const historyNode = document.querySelector("#history");
const summaryNode = document.querySelector("#summary");
const entryTemplate = document.querySelector("#entry-template");
const milestoneGrid = document.querySelector("#milestone-grid");
const milestoneTemplate = document.querySelector("#milestone-template");
const achievementToast = document.querySelector("#achievement-toast");
const toastText = document.querySelector("#toast-text");

let entries = loadEntries();
let editingId = null;
let unlocked = new Set();
let toastTimeout = null;

setDefaultDate();
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const draft = buildEntryDraftFromForm();
  if (!draft) return;

  if (editingId) {
    entries = entries.map((entry) => (entry.id === editingId ? { ...entry, ...draft, updatedAt: new Date().toISOString() } : entry));
  } else {
    entries.push({ id: createId(), ...draft, createdAt: new Date().toISOString(), updatedAt: null });
  }

  persist();
  resetForm();
  render();
});

document.querySelectorAll(".preset").forEach((button) => {
  button.addEventListener("click", () => {
    typeInput.value = button.dataset.type || "";
    unitsInput.value = button.dataset.units || "";
    notesInput.focus();
  });
});

cancelEditButton.addEventListener("click", () => resetForm());

clearAllButton.addEventListener("click", () => {
  if (!entries.length) return;
  if (!window.confirm("Delete all logged entries?")) return;
  entries = [];
  persist();
  resetForm();
  unlocked = new Set();
  hideToast();
  render();
});

historyNode.addEventListener("click", (event) => {
  const actionButton = event.target.closest("button[data-action]");
  if (!actionButton) return;
  const entryId = actionButton.closest(".entry-item")?.dataset.entryId;
  if (!entryId) return;

  if (actionButton.dataset.action === "delete") {
    entries = entries.filter((entry) => entry.id !== entryId);
    persist();
    if (editingId === entryId) resetForm();
    render();
  }

  if (actionButton.dataset.action === "edit") {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    editingId = entry.id;
    dateInput.value = entry.date;
    typeInput.value = entry.type;
    unitsInput.value = String(entry.units);
    notesInput.value = entry.notes;
    saveButton.textContent = "Update entry";
    cancelEditButton.classList.remove("hidden");
    typeInput.focus();
  }
});

function buildEntryDraftFromForm() {
  const date = dateInput.value;
  const type = typeInput.value.trim();
  const units = Number(unitsInput.value);
  const notes = notesInput.value.trim();
  if (!isValidDateString(date) || !type || Number.isNaN(units) || units < 0) return null;
  return { date, type, units: normalizeUnits(units), notes };
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(sanitizeEntry).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function sanitizeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const date = typeof entry.date === "string" ? entry.date : "";
  const type = typeof entry.type === "string" ? entry.type.trim() : "";
  const units = normalizeUnits(Number(entry.units));
  if (!isValidDateString(date) || !type || Number.isNaN(units) || units < 0) return null;
  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : createId(),
    date,
    type,
    units,
    notes: typeof entry.notes === "string" ? entry.notes : "",
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
    updatedAt: typeof entry.updatedAt === "string" || entry.updatedAt === null ? entry.updatedAt : null,
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function resetForm() {
  editingId = null;
  form.reset();
  setDefaultDate();
  saveButton.textContent = "✨ Save entry";
  cancelEditButton.classList.add("hidden");
}

function setDefaultDate() {
  dateInput.value = new Date().toISOString().slice(0, 10);
}

function render() {
  historyNode.innerHTML = "";

  if (!entries.length) {
    summaryNode.textContent = "No entries yet. Add one for today or any previous day.";
    historyNode.innerHTML = '<p class="empty">Your daily history will appear here.</p>';
    renderMilestones(getStats([]));
    return;
  }

  const sorted = [...entries].sort((a, b) => (a.date === b.date ? (b.createdAt || "").localeCompare(a.createdAt || "") : b.date.localeCompare(a.date)));
  const grouped = sorted.reduce((map, entry) => {
    if (!map.has(entry.date)) map.set(entry.date, []);
    map.get(entry.date).push(entry);
    return map;
  }, new Map());

  const totalUnits = sorted.reduce((sum, entry) => sum + entry.units, 0);
  summaryNode.textContent = `${sorted.length} entries across ${grouped.size} days · ${formatUnits(totalUnits)} total units/drinks logged`;

  for (const [date, dayEntries] of grouped) {
    const group = document.createElement("section");
    group.className = "day-group";
    const header = document.createElement("header");
    const heading = document.createElement("strong");
    heading.textContent = formatDate(date);
    const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.units, 0);
    const totalText = document.createElement("span");
    totalText.textContent = `${dayEntries.length} entries · ${formatUnits(dayTotal)} units`;
    header.append(heading, totalText);
    group.append(header);

    const dayList = document.createElement("div");
    dayList.className = "day-list";
    dayEntries.forEach((entry) => {
      const item = entryTemplate.content.firstElementChild.cloneNode(true);
      item.dataset.entryId = entry.id;
      item.querySelector(".entry-meta").textContent = `${entry.type} · ${formatUnits(entry.units)} units`;
      item.querySelector(".entry-notes").textContent = entry.notes || "No notes";
      dayList.append(item);
    });

    group.append(dayList);
    historyNode.append(group);
  }

  renderMilestones(getStats(sorted));
}

function getStats(list) {
  const today = new Date().toISOString().slice(0, 10);
  const daySet = new Set(list.map((entry) => entry.date));
  return {
    entryCount: list.length,
    dayCount: daySet.size,
    hasRetroactive: list.some((entry) => entry.date < today),
  };
}

function renderMilestones(stats) {
  milestoneGrid.innerHTML = "";
  MILESTONES.forEach((milestone) => {
    const unlockedNow = milestone.check(stats);
    const node = milestoneTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".milestone-icon").textContent = milestone.icon;
    node.querySelector(".milestone-title").textContent = milestone.title;
    node.querySelector(".milestone-text").textContent = unlockedNow ? `Unlocked: ${milestone.text}` : milestone.text;
    if (unlockedNow) {
      node.classList.add("unlocked");
      if (!unlocked.has(milestone.id)) {
        unlocked.add(milestone.id);
        showToast(`${milestone.icon} ${milestone.title}: ${milestone.text}`);
      }
    }
    milestoneGrid.append(node);
  });
}

function showToast(message) {
  toastText.textContent = message;
  achievementToast.classList.remove("hidden");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => hideToast(), 2600);
}

function hideToast() {
  achievementToast.classList.add("hidden");
}

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatUnits(units) {
  return Number.isInteger(units) ? String(units) : units.toFixed(1);
}
function normalizeUnits(units) {
  return Math.round(units * 10) / 10;
}
function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function createId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
