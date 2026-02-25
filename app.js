const STORAGE_KEY = "alcohol-reduction-log-v1";

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

let entries = loadEntries();
let editingId = null;

setDefaultDate();
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const draft = buildEntryDraftFromForm();
  if (!draft) {
    return;
  }

  if (editingId) {
    entries = entries.map((entry) =>
      entry.id === editingId
        ? {
            ...entry,
            ...draft,
            updatedAt: new Date().toISOString(),
          }
        : entry
    );
  } else {
    entries.push({
      id: createId(),
      ...draft,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    });
  }

  persist();
  resetForm();
  render();
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
});

clearAllButton.addEventListener("click", () => {
  if (!entries.length) {
    return;
  }

  const shouldClear = window.confirm("Delete all logged entries?");
  if (!shouldClear) {
    return;
  }

  entries = [];
  persist();
  resetForm();
  render();
});

historyNode.addEventListener("click", (event) => {
  const actionButton = event.target.closest("button[data-action]");
  if (!actionButton) {
    return;
  }

  const { action } = actionButton.dataset;
  const entryId = actionButton.closest(".entry-item")?.dataset.entryId;
  if (!entryId) {
    return;
  }

  if (action === "delete") {
    entries = entries.filter((entry) => entry.id !== entryId);
    persist();
    if (editingId === entryId) {
      resetForm();
    }
    render();
    return;
  }

  if (action === "edit") {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }

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

  if (!isValidDateString(date) || !type || Number.isNaN(units) || units < 0) {
    return null;
  }

  return {
    date,
    type,
    units: normalizeUnits(units),
    notes,
  };
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => sanitizeEntry(entry))
      .filter((entry) => entry !== null);
  } catch {
    return [];
  }
}

function sanitizeEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const date = typeof entry.date === "string" ? entry.date : "";
  const type = typeof entry.type === "string" ? entry.type.trim() : "";
  const units = normalizeUnits(Number(entry.units));

  if (!isValidDateString(date) || !type || Number.isNaN(units) || units < 0) {
    return null;
  }

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
  saveButton.textContent = "Save entry";
  cancelEditButton.classList.add("hidden");
}

function setDefaultDate() {
  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;
}

function render() {
  historyNode.innerHTML = "";

  if (!entries.length) {
    summaryNode.textContent = "No entries yet. Add one for today or any previous day.";
    historyNode.innerHTML = '<p class="empty">Your daily history will appear here.</p>';
    return;
  }

  const sorted = [...entries].sort((a, b) => {
    if (a.date === b.date) {
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    }
    return b.date.localeCompare(a.date);
  });

  const grouped = sorted.reduce((map, entry) => {
    if (!map.has(entry.date)) {
      map.set(entry.date, []);
    }
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
}

function formatDate(dateStr) {
  const parsed = new Date(`${dateStr}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
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
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
