/* GeoAtlas — app.js
   Data model: Event { id, title, date, severity(0-4), location, lat, lng,
   countries[], topics[], summary, notes, links[] }
   Storage: localStorage, seeded once from data.json on first load.
*/

const SEVERITY_LABELS = ["Information", "Low", "Medium", "High", "Critical"];
const SEVERITY_COLORS = ["#4a6fa5", "#4f9d6c", "#d9b23c", "#d97a3c", "#c0392b"];
const STORAGE_KEY = "geoatlas_events_v1";

// Simple client-side gate, not real security. Meant only to prevent
// accidental edits during normal viewing, not to protect shared data.
// Change this before deploying if you want a different passphrase.
const ADMIN_PASSWORD = "geoatlas";
const ADMIN_SESSION_KEY = "geoatlas_admin_unlocked";
const CUSTOM_COUNTRIES_KEY = "geoatlas_custom_countries";
const CUSTOM_TOPICS_KEY = "geoatlas_custom_topics";

let map;
let markersLayer;
let events = [];
let activeFilters = { countries: new Set(), topic: "", minSeverity: 0 };
let pendingLatLng = null;
let isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
let customCountries = loadJsonArray(CUSTOM_COUNTRIES_KEY);
let customTopics = loadJsonArray(CUSTOM_TOPICS_KEY);
let formSelectedCountries = new Set();
let formSelectedTopics = new Set();

function loadJsonArray(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function getAllCountryNames() {
  const set = new Set(COUNTRY_LIBRARY.map(c => c.name));
  customCountries.forEach(c => set.add(c));
  events.forEach(ev => (ev.countries || []).forEach(c => set.add(c)));
  return [...set].sort();
}

function getAllTopicNames() {
  const set = new Set(TOPIC_LIBRARY);
  customTopics.forEach(t => set.add(t));
  events.forEach(ev => (ev.topics || []).forEach(t => set.add(t)));
  return [...set].sort();
}

init();

async function init() {
  events = loadEvents();
  if (events.length === 0) {
    try {
      const res = await fetch("data.json");
      events = await res.json();
      saveEvents();
    } catch (e) {
      console.warn("Could not load seed data.json", e);
    }
  }

  buildMap();
  buildLegend();
  buildFilterOptions();
  bindUI();
  applyModeUI();
  render();
}

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function buildMap() {
  map = L.map("map", { worldCopyJump: true }).setView([20, 30], 2.4);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 18
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  map.on("click", (e) => {
    if (!isAdmin) return;
    pendingLatLng = e.latlng;
    openModal();
  });
}

function buildLegend() {
  const legend = document.getElementById("legend");
  legend.innerHTML = SEVERITY_LABELS.map((label, i) => `
    <li><span class="dot" style="background:${SEVERITY_COLORS[i]}"></span>${label}</li>
  `).join("");
}

function buildFilterOptions() {
  renderDropdownOptions("countryFilterList", getAllCountryNames(), activeFilters.countries, (name, checked) => {
    if (checked) activeFilters.countries.add(name);
    else activeFilters.countries.delete(name);
    updateCountrySelectedCount();
    render();
  }, "");

  updateCountrySelectedCount();

  const topicSel = document.getElementById("topicFilter");
  getAllTopicNames().forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    topicSel.appendChild(opt);
  });
}

function updateCountrySelectedCount() {
  const badge = document.getElementById("countrySelectedCount");
  const toggle = document.getElementById("countryFilterToggle");
  const n = activeFilters.countries.size;
  badge.textContent = n > 0 ? `${n} selected` : "";
  toggle.textContent = n > 0 ? `${n} region${n > 1 ? "s" : ""} selected` : "All regions";
}

function bindUI() {
  document.getElementById("newEventBtn").addEventListener("click", () => {
    if (!isAdmin) { openAdminModal(); return; }
    pendingLatLng = null;
    openModal();
  });

  setupDropdown("countryFilterToggle", "countryFilterPanel", "countryFilterSearch");
  document.getElementById("countryFilterSearch").addEventListener("input", e => {
    renderDropdownOptions("countryFilterList", getAllCountryNames(), activeFilters.countries, (name, checked) => {
      if (checked) activeFilters.countries.add(name);
      else activeFilters.countries.delete(name);
      updateCountrySelectedCount();
      render();
    }, e.target.value);
  });

  setupDropdown("fCountriesToggle", "fCountriesPanel", "fCountriesSearch", () => renderTagPicker("country"));
  document.getElementById("fCountriesSearch").addEventListener("input", e => renderTagPicker("country", e.target.value));

  setupDropdown("fTopicsToggle", "fTopicsPanel", "fTopicsSearch", () => renderTagPicker("topic"));
  document.getElementById("fTopicsSearch").addEventListener("input", e => renderTagPicker("topic", e.target.value));

  document.addEventListener("click", closeAllDropdowns);

  document.getElementById("fCountriesAddBtn").addEventListener("click", () => {
    addCustomTag("country");
  });
  document.getElementById("fCountriesNew").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addCustomTag("country"); }
  });
  document.getElementById("fTopicsAddBtn").addEventListener("click", () => {
    addCustomTag("topic");
  });
  document.getElementById("fTopicsNew").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addCustomTag("topic"); }
  });

  document.getElementById("topicFilter").addEventListener("change", e => {
    activeFilters.topic = e.target.value;
    render();
  });
  document.getElementById("severityFilter").addEventListener("change", e => {
    activeFilters.minSeverity = parseInt(e.target.value, 10);
    render();
  });
  document.getElementById("clearFilters").addEventListener("click", () => {
    activeFilters = { countries: new Set(), topic: "", minSeverity: 0 };
    document.querySelectorAll("#countryFilterList input[type=checkbox]").forEach(cb => cb.checked = false);
    updateCountrySelectedCount();
    document.getElementById("topicFilter").value = "";
    document.getElementById("severityFilter").value = "0";
    render();
  });

  document.getElementById("adminToggle").addEventListener("click", onAdminToggle);
  document.getElementById("adminForm").addEventListener("submit", onAdminSubmit);
  document.getElementById("adminCancel").addEventListener("click", closeAdminModal);
  document.getElementById("adminModalClose").addEventListener("click", closeAdminModal);
  document.getElementById("adminOverlay").addEventListener("click", e => {
    if (e.target.id === "adminOverlay") closeAdminModal();
  });

  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("cancelForm").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", e => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  document.getElementById("eventForm").addEventListener("submit", onSaveEvent);
  document.getElementById("deleteEvent").addEventListener("click", onDeleteEvent);
}

function getFilteredEvents() {
  return events.filter(ev => {
    if (activeFilters.countries.size > 0) {
      const evCountries = ev.countries || [];
      const hasMatch = evCountries.some(c => activeFilters.countries.has(c));
      if (!hasMatch) return false;
    }
    if (activeFilters.topic && !(ev.topics || []).includes(activeFilters.topic)) return false;
    if ((ev.severity || 0) < activeFilters.minSeverity) return false;
    return true;
  });
}

function render() {
  const filtered = getFilteredEvents();
  renderMarkers(filtered);
  renderEventList(filtered);
  renderGlobalStats();
}

function renderMarkers(list) {
  markersLayer.clearLayers();
  list.forEach(ev => {
    if (ev.lat == null || ev.lng == null) return;
    const color = SEVERITY_COLORS[ev.severity || 0];
    const marker = L.circleMarker([ev.lat, ev.lng], {
      radius: 6 + (ev.severity || 0) * 1.5,
      color: color,
      fillColor: color,
      fillOpacity: 0.75,
      weight: 1.5
    });
    marker.bindPopup(buildPopupHTML(ev));
    marker.on("popupopen", () => {
      const editBtn = document.getElementById(`edit-${ev.id}`);
      if (editBtn) editBtn.addEventListener("click", () => openModal(ev));
    });
    marker.addTo(markersLayer);
  });
}

function buildPopupHTML(ev) {
  const countries = (ev.countries || []).join(", ") || "—";
  const sev = SEVERITY_LABELS[ev.severity || 0];
  return `
    <div class="popup-title">${escapeHtml(ev.title)}</div>
    <div class="popup-meta">${ev.date || ""} &middot; ${sev} &middot; ${escapeHtml(countries)}</div>
    <div style="font-size:12px; margin-bottom:6px;">${escapeHtml(ev.summary || "")}</div>
    <span class="popup-link" id="edit-${ev.id}">${isAdmin ? "Open / edit" : "View details"}</span>
  `;
}

function renderEventList(list) {
  const wrap = document.getElementById("eventList");
  document.getElementById("eventCount").textContent = list.length;

  if (list.length === 0) {
    wrap.innerHTML = `<p class="empty-note">No events match the current filters.</p>`;
    return;
  }

  const sorted = [...list].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  wrap.innerHTML = sorted.map(ev => `
    <div class="event-card" style="border-left-color:${SEVERITY_COLORS[ev.severity || 0]}" data-id="${ev.id}">
      <div class="ev-title">${escapeHtml(ev.title)}</div>
      <div class="ev-meta">${ev.date || ""} &middot; ${SEVERITY_LABELS[ev.severity || 0]}</div>
    </div>
  `).join("");

  wrap.querySelectorAll(".event-card").forEach(card => {
    card.addEventListener("click", () => {
      const ev = events.find(e => e.id === card.dataset.id);
      if (ev) {
        openModal(ev);
        if (ev.lat != null && ev.lng != null) map.setView([ev.lat, ev.lng], 5);
      }
    });
  });
}

function renderGlobalStats() {
  const total = events.length;
  const critical = events.filter(e => e.severity === 4).length;
  document.getElementById("globalStats").innerHTML =
    `<span><b>${total}</b> events</span><span><b>${critical}</b> critical</span>`;
}

/* ---- Admin / viewer mode ---- */

function applyModeUI() {
  const badge = document.getElementById("modeBadge");
  const toggleBtn = document.getElementById("adminToggle");
  const hint = document.getElementById("mapHint");

  if (isAdmin) {
    badge.textContent = "Editing unlocked";
    badge.classList.add("admin");
    toggleBtn.textContent = "Lock editing";
    hint.textContent = "Click anywhere on the map to log a new event at that location.";
  } else {
    badge.textContent = "Viewer mode";
    badge.classList.remove("admin");
    toggleBtn.textContent = "Unlock editing";
    hint.textContent = "Viewer mode. Unlock editing to add events.";
  }
}

function onAdminToggle() {
  if (isAdmin) {
    isAdmin = false;
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    applyModeUI();
    render();
    return;
  }
  openAdminModal();
}

function openAdminModal() {
  document.getElementById("adminError").classList.add("hidden");
  document.getElementById("adminPasswordInput").value = "";
  document.getElementById("adminOverlay").classList.remove("hidden");
  document.getElementById("adminPasswordInput").focus();
}

function closeAdminModal() {
  document.getElementById("adminOverlay").classList.add("hidden");
}

function onAdminSubmit(e) {
  e.preventDefault();
  const entered = document.getElementById("adminPasswordInput").value;
  if (entered === ADMIN_PASSWORD) {
    isAdmin = true;
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    applyModeUI();
    closeAdminModal();
    render();
  } else {
    document.getElementById("adminError").classList.remove("hidden");
  }
}

/* ---- Generic dropdown multi-select ---- */

function renderDropdownOptions(listElId, options, selectedSet, onToggle, searchTerm, disabled = false) {
  const container = document.getElementById(listElId);
  const filtered = searchTerm
    ? options.filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  if (filtered.length === 0) {
    container.innerHTML = `<p class="empty-chip-note">No matches.</p>`;
    return;
  }

  container.innerHTML = filtered.map(name => {
    const safeId = `${listElId}-${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const checked = selectedSet.has(name) ? "checked" : "";
    const disabledAttr = disabled ? "disabled" : "";
    return `
      <div class="checkbox-row">
        <input type="checkbox" id="${safeId}" value="${escapeHtml(name)}" ${checked} ${disabledAttr} />
        <label for="${safeId}">${escapeHtml(name)}</label>
      </div>
    `;
  }).join("");

  if (!disabled) {
    container.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener("change", () => onToggle(cb.value, cb.checked));
    });
  }
}

function setupDropdown(toggleId, panelId, searchId, onOpen) {
  const toggle = document.getElementById(toggleId);
  const panel = document.getElementById(panelId);

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !panel.classList.contains("hidden");
    closeAllDropdowns();
    if (!isOpen) {
      panel.classList.remove("hidden");
      if (onOpen) onOpen();
      const search = document.getElementById(searchId);
      if (search) { search.value = ""; search.focus(); }
    }
  });

  panel.addEventListener("click", e => e.stopPropagation());
}

function closeAllDropdowns() {
  document.querySelectorAll(".dropdown-panel").forEach(p => p.classList.add("hidden"));
}

/* ---- Region / topic picker (event form) ---- */

function renderTagPicker(kind, searchTerm = "") {
  const listId = kind === "country" ? "fCountriesPicker" : "fTopicsPicker";
  const selectedSet = kind === "country" ? formSelectedCountries : formSelectedTopics;
  const options = kind === "country" ? getAllCountryNames() : getAllTopicNames();
  const readOnly = !isAdmin;

  renderDropdownOptions(listId, options, selectedSet, (name, checked) => {
    if (checked) selectedSet.add(name);
    else selectedSet.delete(name);
    updateFormToggleLabel(kind);
  }, searchTerm, readOnly);
}

function updateFormToggleLabel(kind) {
  const toggleId = kind === "country" ? "fCountriesToggle" : "fTopicsToggle";
  const noun = kind === "country" ? "region" : "topic";
  const selectedSet = kind === "country" ? formSelectedCountries : formSelectedTopics;
  const toggle = document.getElementById(toggleId);
  const n = selectedSet.size;
  toggle.textContent = n > 0 ? `${n} ${noun}${n > 1 ? "s" : ""} selected` : `Select ${noun}s`;
}

function addCustomTag(kind) {
  const inputId = kind === "country" ? "fCountriesNew" : "fTopicsNew";
  const input = document.getElementById(inputId);
  const value = input.value.trim();
  if (!value) return;

  const selectedSet = kind === "country" ? formSelectedCountries : formSelectedTopics;
  const storageKey = kind === "country" ? CUSTOM_COUNTRIES_KEY : CUSTOM_TOPICS_KEY;
  const list = kind === "country" ? customCountries : customTopics;
  const allOptions = kind === "country" ? getAllCountryNames() : getAllTopicNames();

  const existing = allOptions.find(n => n.toLowerCase() === value.toLowerCase());
  const finalValue = existing || value;

  if (!existing) {
    list.push(finalValue);
    localStorage.setItem(storageKey, JSON.stringify(list));
  }

  selectedSet.add(finalValue);
  input.value = "";
  renderTagPicker(kind);
  updateFormToggleLabel(kind);
}

/* ---- Modal / form ---- */

function openModal(ev = null) {
  const form = document.getElementById("eventForm");
  form.reset();

  const readOnly = !isAdmin;
  const deleteBtn = document.getElementById("deleteEvent");
  if (ev && !readOnly) deleteBtn.classList.remove("hidden");
  else deleteBtn.classList.add("hidden");

  document.querySelector("#eventForm button[type=submit]").classList.toggle("hidden", readOnly);
  form.querySelectorAll("input, select, textarea").forEach(el => { el.disabled = readOnly; });
  document.getElementById("fCountriesNew").disabled = readOnly;
  document.getElementById("fCountriesAddBtn").disabled = readOnly;
  document.getElementById("fTopicsNew").disabled = readOnly;
  document.getElementById("fTopicsAddBtn").disabled = readOnly;
  document.getElementById("fCountriesToggle").disabled = readOnly;
  document.getElementById("fTopicsToggle").disabled = readOnly;

  formSelectedCountries = new Set(ev ? (ev.countries || []) : []);
  formSelectedTopics = new Set(ev ? (ev.topics || []) : []);
  renderTagPicker("country");
  renderTagPicker("topic");
  updateFormToggleLabel("country");
  updateFormToggleLabel("topic");
  closeAllDropdowns();

  if (ev) {
    document.getElementById("modalTitle").textContent = readOnly ? "Event details" : "Edit event";
    document.getElementById("eventId").value = ev.id;
    document.getElementById("eventLat").value = ev.lat ?? "";
    document.getElementById("eventLng").value = ev.lng ?? "";
    document.getElementById("fTitle").value = ev.title || "";
    document.getElementById("fDate").value = ev.date || "";
    document.getElementById("fSeverity").value = ev.severity ?? 2;
    document.getElementById("fLocation").value = ev.location || "";
    document.getElementById("fSummary").value = ev.summary || "";
    document.getElementById("fNotes").value = ev.notes || "";
    document.getElementById("fLinks").value = (ev.links || []).join(", ");
  } else {
    document.getElementById("modalTitle").textContent = "New event";
    document.getElementById("eventId").value = "";
    document.getElementById("eventLat").value = pendingLatLng ? pendingLatLng.lat.toFixed(4) : "";
    document.getElementById("eventLng").value = pendingLatLng ? pendingLatLng.lng.toFixed(4) : "";
    document.getElementById("fSeverity").value = 2;
  }

  document.getElementById("modalOverlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.add("hidden");
  pendingLatLng = null;
}

function onSaveEvent(e) {
  e.preventDefault();

  const lat = parseFloat(document.getElementById("eventLat").value);
  const lng = parseFloat(document.getElementById("eventLng").value);
  if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    alert("Enter a valid latitude (-90 to 90) and longitude (-180 to 180).");
    return;
  }

  const id = document.getElementById("eventId").value || `ev-${Date.now()}`;
  const newEvent = {
    id,
    title: document.getElementById("fTitle").value.trim(),
    date: document.getElementById("fDate").value,
    severity: parseInt(document.getElementById("fSeverity").value, 10),
    location: document.getElementById("fLocation").value.trim(),
    lat: lat,
    lng: lng,
    countries: [...formSelectedCountries],
    topics: [...formSelectedTopics],
    summary: document.getElementById("fSummary").value.trim(),
    notes: document.getElementById("fNotes").value.trim(),
    links: splitList(document.getElementById("fLinks").value)
  };

  const idx = events.findIndex(ev => ev.id === id);
  if (idx >= 0) events[idx] = newEvent;
  else events.push(newEvent);

  saveEvents();
  buildFilterOptions_refreshOnly();
  closeModal();
  render();
}

function onDeleteEvent() {
  const id = document.getElementById("eventId").value;
  if (!id) return;
  if (!confirm("Delete this event?")) return;
  events = events.filter(ev => ev.id !== id);
  saveEvents();
  closeModal();
  render();
}

function buildFilterOptions_refreshOnly() {
  // Rebuild filter options to include any newly typed countries/topics.
  // buildFilterOptions() already preserves checked state for countries
  // by reading activeFilters.countries, so we just need to preserve the
  // topic dropdown's current selection.
  const topicSel = document.getElementById("topicFilter");
  const curTopic = topicSel.value;
  topicSel.innerHTML = `<option value="">All topics</option>`;
  buildFilterOptions();
  topicSel.value = curTopic;
}

/* ---- utils ---- */

function splitList(str) {
  return str.split(",").map(s => s.trim()).filter(Boolean);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
