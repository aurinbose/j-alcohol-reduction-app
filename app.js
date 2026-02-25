const STORAGE_KEY = "alcohol-reduction-log-v2";

const MILESTONES = [
  { id: "first-sober", icon: "🌱", title: "First Sober Day", text: "Log your first alcohol-free day", check: (s) => s.totalSoberDays >= 1 },
  { id: "streak-3", icon: "🔥", title: "3-Day Streak", text: "Reach a 3-day sober streak", check: (s) => s.currentSoberStreak >= 3 },
  { id: "sober-7", icon: "🏅", title: "Week Champion", text: "Log 7 total sober days", check: (s) => s.totalSoberDays >= 7 },
  { id: "streak-7", icon: "🏆", title: "7-Day Streak", text: "Reach a 7-day sober streak", check: (s) => s.currentSoberStreak >= 7 },
  { id: "sober-30", icon: "👑", title: "30 Sober Days", text: "Log 30 total sober days", check: (s) => s.totalSoberDays >= 30 },
];

const form = document.querySelector("#entry-form");
const dateInput = document.querySelector("#entry-date");
const typeInput = document.querySelector("#entry-type");
const unitsInput = document.querySelector("#entry-units");
const notesInput = document.querySelector("#entry-notes");
const drinkDetails = document.querySelector("#drink-details");
const soberStatusButton = document.querySelector("#status-sober");
const drankStatusButton = document.querySelector("#status-drank");
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
const currentStreakNode = document.querySelector("#current-streak");
const bestStreakNode = document.querySelector("#best-streak");
const totalSoberDaysNode = document.querySelector("#total-sober-days");

let entries = loadEntries();
let editingId = null;
let selectedStatus = "sober";
let unlocked = new Set();
let toastTimeout = null;

setDefaultDate();
setStatus("sober");
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const draft = buildDraft();
  if (!draft) return;

  if (editingId) {
    entries = entries.map((entry) =>
      entry.id === editingId ? { ...entry, ...draft, updatedAt: new Date().toISOString() } : entry
    );
  } else {
    const existingForDate = entries.find((entry) => entry.date === draft.date);
    if (existingForDate) {
      entries = entries.map((entry) =>
        entry.id === existingForDate.id ? { ...entry, ...draft, updatedAt: new Date().toISOString() } : entry
      );
    } else {
      entries.push({ id: createId(), ...draft, createdAt: new Date().toISOString(), updatedAt: null });
    }
  }

  persist();
  resetForm();
  render();
});

soberStatusButton.addEventListener("click", () => setStatus("sober"));
drankStatusButton.addEventListener("click", () => setStatus("drank"));

document.querySelectorAll(".preset").forEach((button) => {
  button.addEventListener("click", () => {
    setStatus("drank");
    typeInput.value = button.dataset.type || "";
    unitsInput.value = button.dataset.units || "";
    notesInput.focus();
  });
});

cancelEditButton.addEventListener("click", () => resetForm());

clearAllButton.addEventListener("click", () => {
  if (!entries.length) return;
  if (!window.confirm("Delete all logged days?")) return;

  entries = [];
  unlocked = new Set();
  hideToast();
  persist();
  resetForm();
  render();
});

historyNode.addEventListener("click", (event) => {
  const actionButton = event.target.closest("button[data-action]");
  if (!actionButton) return;

  const entryId = actionButton.closest(".entry-item")?.dataset.entryId;
  if (!entryId) return;

  if (actionButton.dataset.action === "delete") {
    entries = entries.filter((entry) => entry.id !== entryId);
    if (editingId === entryId) resetForm();
    persist();
    render();
    return;
  }

  const entry = entries.find((item) => item.id === entryId);
  if (!entry) return;

  editingId = entry.id;
  dateInput.value = entry.date;
  notesInput.value = entry.notes || "";
  setStatus(entry.hadDrink ? "drank" : "sober");
  typeInput.value = entry.type || "";
  unitsInput.value = entry.units > 0 ? String(entry.units) : "";
  saveButton.textContent = "Update day";
  cancelEditButton.classList.remove("hidden");
});

function setStatus(status) {
  selectedStatus = status;
  const isDrank = status === "drank";

  soberStatusButton.classList.toggle("active", !isDrank);
  drankStatusButton.classList.toggle("active", isDrank);
  drinkDetails.classList.toggle("hidden", !isDrank);

  typeInput.required = isDrank;
  unitsInput.required = isDrank;

  if (!isDrank) {
    typeInput.value = "";
    unitsInput.value = "";
  }
}

function buildDraft() {
  const date = dateInput.value;
  const notes = notesInput.value.trim();

  if (!isValidDateString(date)) return null;

  if (selectedStatus === "sober") {
    return {
      date,
      hadDrink: false,
      type: "",
      units: 0,
      notes,
    };
  }

  const type = typeInput.value.trim();
  const units = Number(unitsInput.value);
  if (!type || Number.isNaN(units) || units <= 0) return null;

  return {
    date,
    hadDrink: true,
    type,
    units: normalizeUnits(units),
    notes,
  };
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(sanitizeEntry).filter(Boolean);
  } catch {
    return [];
  }
}

function sanitizeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  const date = typeof entry.date === "string" ? entry.date : "";
  if (!isValidDateString(date)) return null;

  const hadDrink = Boolean(entry.hadDrink);
  const units = normalizeUnits(Number(entry.units));

  if (hadDrink && (Number.isNaN(units) || units <= 0)) return null;

  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : createId(),
    date,
    hadDrink,
    type: hadDrink && typeof entry.type === "string" ? entry.type.trim() : "",
    units: hadDrink ? units : 0,
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
  setStatus("sober");
  saveButton.textContent = "Save day";
  cancelEditButton.classList.add("hidden");
}

function setDefaultDate() {
  dateInput.value = new Date().toISOString().slice(0, 10);
}

function render() {
  historyNode.innerHTML = "";

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  if (!sorted.length) {
    summaryNode.textContent = "No days logged yet. Start by marking today as alcohol-free.";
    historyNode.innerHTML = '<p class="empty">Your logged days will appear here.</p>';
    updateStats([]);
    renderMilestones({ currentSoberStreak: 0, bestSoberStreak: 0, totalSoberDays: 0 });
    return;
  }

  const soberDays = sorted.filter((entry) => !entry.hadDrink);
  const drinkDays = sorted.filter((entry) => entry.hadDrink);

  summaryNode.textContent = `${soberDays.length} sober days · ${drinkDays.length} drink days · ${formatUnits(drinkDays.reduce((sum, e) => sum + e.units, 0))} total units on drink days`;

  sorted.forEach((entry) => {
    const node = entryTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.entryId = entry.id;

    const statusText = entry.hadDrink
      ? `🍷 Had drink · ${entry.type} · ${formatUnits(entry.units)} units`
      : "✅ Alcohol-free day";

    node.querySelector(".entry-meta").textContent = `${formatDate(entry.date)} · ${statusText}`;
    node.querySelector(".entry-notes").textContent = entry.notes || "No notes";
    historyNode.append(node);
  });

  const stats = computeSoberStats(sorted);
  updateStats(stats);
  renderMilestones(stats);
}

function computeSoberStats(sortedEntries) {
  const byDate = new Map(sortedEntries.map((entry) => [entry.date, entry]));
  const soberDates = sortedEntries.filter((entry) => !entry.hadDrink).map((entry) => entry.date).sort();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentSoberStreak = 0;
  for (let i = 0; i < 3650; i += 1) {
    const cursor = new Date(today);
    cursor.setDate(today.getDate() - i);
    const key = cursor.toISOString().slice(0, 10);
    const entry = byDate.get(key);

    if (!entry) break;
    if (entry.hadDrink) break;

    currentSoberStreak += 1;
  }

  let bestSoberStreak = 0;
  let running = 0;
  let prevDate = null;

  soberDates.forEach((dateStr) => {
    if (!prevDate) {
      running = 1;
      bestSoberStreak = 1;
      prevDate = dateStr;
      return;
    }

    const prev = new Date(`${prevDate}T00:00:00`);
    const curr = new Date(`${dateStr}T00:00:00`);
    const dayDiff = Math.round((curr - prev) / (24 * 60 * 60 * 1000));

    running = dayDiff === 1 ? running + 1 : 1;
    bestSoberStreak = Math.max(bestSoberStreak, running);
    prevDate = dateStr;
  });

  return {
    totalSoberDays: soberDates.length,
    currentSoberStreak,
    bestSoberStreak,
  };
}

function updateStats(stats) {
  currentStreakNode.textContent = String(stats.currentSoberStreak || 0);
  bestStreakNode.textContent = String(stats.bestSoberStreak || 0);
  totalSoberDaysNode.textContent = String(stats.totalSoberDays || 0);
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
        showToast(`${milestone.icon} ${milestone.title}`);
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
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
