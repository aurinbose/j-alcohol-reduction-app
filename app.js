const STORAGE_KEY = "alcohol-reduction-log-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

const MILESTONES = [
  { id: "first-log", icon: "🌟", title: "First Step", text: "Log your first day", check: (s) => s.entryCount >= 1 },
  { id: "retro-log", icon: "🕒", title: "Backfiller", text: "Add a retroactive log", check: (s) => s.hasRetroactive },
  { id: "streak-3", icon: "🔥", title: "3-Day Streak", text: "Reach 3 alcohol-free days in a row", check: (s) => s.currentStreak >= 3 },
  { id: "sober-10", icon: "🏆", title: "Sober 10", text: "Reach 10 alcohol-free days", check: (s) => s.totalSoberDays >= 10 },
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
const nextMilestoneNode = document.querySelector("#next-milestone");
const weekStripNode = document.querySelector("#week-strip");
const toastNode = document.querySelector("#achievement-toast");
const toastText = document.querySelector("#toast-text");
const currentStreakNode = document.querySelector("#current-streak");
const bestStreakNode = document.querySelector("#best-streak");
const totalSoberNode = document.querySelector("#total-sober");
const soberButton = document.querySelector("#btn-sober");
const drinkButton = document.querySelector("#btn-drink");

let entries = loadEntries();
let editingId = null;
let unlocked = new Set();
let toastTimer = null;

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

soberButton.addEventListener("click", () => {
  unitsInput.value = "0";
  if (!typeInput.value.trim()) typeInput.value = "Alcohol-Free";
  notesInput.focus();
});

drinkButton.addEventListener("click", () => {
  if (!unitsInput.value) unitsInput.value = "1";
  if (!typeInput.value.trim()) typeInput.value = "Drink";
  typeInput.focus();
});

cancelEditButton.addEventListener("click", resetForm);

clearAllButton.addEventListener("click", () => {
  if (!entries.length) return;
  if (!window.confirm("Delete all logged entries?")) return;
  entries = [];
  unlocked = new Set();
  hideToast();
  persist();
  resetForm();
  render();
});

historyNode.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.closest(".entry-item")?.dataset.entryId;
  if (!id) return;

  if (button.dataset.action === "delete") {
    entries = entries.filter((entry) => entry.id !== id);
    persist();
    if (editingId === id) resetForm();
    render();
    return;
  }

  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  editingId = entry.id;
  dateInput.value = entry.date;
  typeInput.value = entry.type;
  unitsInput.value = String(entry.units);
  notesInput.value = entry.notes;
  saveButton.textContent = "Update entry";
  cancelEditButton.classList.remove("hidden");
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
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
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

function setDefaultDate() {
  dateInput.value = new Date().toISOString().slice(0, 10);
}

function resetForm() {
  editingId = null;
  form.reset();
  setDefaultDate();
  saveButton.textContent = "Save entry";
  cancelEditButton.classList.add("hidden");
}

function render() {
  historyNode.innerHTML = "";

  const sorted = [...entries].sort((a, b) => (a.date === b.date ? (b.createdAt || "").localeCompare(a.createdAt || "") : b.date.localeCompare(a.date)));
  const grouped = sorted.reduce((map, entry) => {
    if (!map.has(entry.date)) map.set(entry.date, []);
    map.get(entry.date).push(entry);
    return map;
  }, new Map());

  if (!sorted.length) {
    summaryNode.textContent = "No entries yet. Start with today or add previous days retroactively.";
    historyNode.innerHTML = '<p class="entry-notes">No logs yet.</p>';
  } else {
    const totalUnits = sorted.reduce((sum, entry) => sum + entry.units, 0);
    summaryNode.textContent = `${sorted.length} entries across ${grouped.size} days · ${formatUnits(totalUnits)} units`;

    sorted.forEach((entry) => {
      const node = entryTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.entryId = entry.id;
      node.querySelector(".entry-meta").textContent = `${formatDate(entry.date)} · ${entry.type} · ${formatUnits(entry.units)} units`;
      node.querySelector(".entry-notes").textContent = entry.notes || "No notes";
      historyNode.append(node);
    });
  }

  const stats = getStats(grouped);
  currentStreakNode.textContent = String(stats.currentStreak);
  bestStreakNode.textContent = String(stats.bestStreak);
  totalSoberNode.textContent = String(stats.totalSoberDays);
  renderWeekStrip(grouped);
  renderMilestones(stats);
}

function getStats(grouped) {
  const dayEntries = [...grouped.entries()].map(([date, list]) => ({
    date,
    total: list.reduce((sum, item) => sum + item.units, 0),
  })).sort((a, b) => a.date.localeCompare(b.date));

  const soberDays = dayEntries.filter((day) => day.total === 0).map((day) => day.date);
  const soberSet = new Set(soberDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  let cursor = new Date(today);
  while (soberSet.has(toISO(cursor))) {
    currentStreak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  let bestStreak = 0;
  let run = 0;
  for (const day of dayEntries) {
    if (day.total === 0) {
      run += 1;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
  }

  return {
    entryCount: entries.length,
    hasRetroactive: entries.some((entry) => entry.date < toISO(today)),
    currentStreak,
    bestStreak,
    totalSoberDays: soberDays.length,
  };
}

function renderWeekStrip(grouped) {
  weekStripNode.innerHTML = "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i -= 1) {
    const dayDate = new Date(today.getTime() - i * DAY_MS);
    const key = toISO(dayDate);
    const entriesForDay = grouped.get(key) || [];
    const total = entriesForDay.reduce((sum, item) => sum + item.units, 0);
    const box = document.createElement("div");
    box.className = "day-box";
    if (entriesForDay.length) box.classList.add(total === 0 ? "sober" : "drink");
    box.innerHTML = `<div>${dayDate.toLocaleDateString(undefined, { weekday: "short" })}</div><div>${entriesForDay.length ? formatUnits(total) + "u" : "-"}</div>`;
    weekStripNode.append(box);
  }
}

function renderMilestones(stats) {
  milestoneGrid.innerHTML = "";

  const next = MILESTONES.find((m) => !m.check(stats));
  nextMilestoneNode.textContent = next ? `${next.icon} ${next.title} — ${next.text}` : "🎉 All milestones unlocked!";

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
        showToast(`${milestone.icon} ${milestone.title}`);
      }
    }

    milestoneGrid.append(node);
  });
}

function showToast(message) {
  toastText.textContent = message;
  toastNode.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 2200);
}

function hideToast() {
  toastNode.classList.add("hidden");
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
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

function toISO(date) {
  return date.toISOString().slice(0, 10);
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
