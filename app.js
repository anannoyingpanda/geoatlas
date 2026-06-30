/* GeoAtlas — app.js
   Data model: Event { id, title, date, severity(0-4), location, lat, lng,
   countries[], topics[], summary, notes, links[] }
   Storage: localStorage, seeded once from data.json on first load.
*/

const SEVERITY_LABELS = ["Information", "Low", "Medium", "High", "Critical"];
const SEVERITY_COLORS = ["#4a6fa5", "#4f9d6c", "#d9b23c", "#d97a3c", "#c0392b"];
const STORAGE_KEY = "geoatlas_events_v1";

let map;
let markersLayer;
let events = [];
let activeFilters = { country: "", topic: "", minSeverity: 0 };
let pendingLatLng = null;

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
  const countrySel = document.getElementById("countryFilter");
  const allCountries = new Set(COUNTRY_LIBRARY.map(c => c.name));
  events.forEach(ev => (ev.countries || []).forEach(c => allCountries.add(c)));
  [...allCountries].sort().forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    countrySel.appendChild(opt);
  });

  const topicSel = document.getElementById("topicFilter");
  const allTopics = new Set(TOPIC_LIBRARY);
  events.forEach(ev => (ev.topics || []).forEach(t => allTopics.add(t)));
  [...allTopics].sort().forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    topicSel.appendChild(opt);
  });
}

function bindUI() {
  document.getElementById("countryFilter").addEventListener("change", e => {
    activeFilters.country = e.target.value;
    render();
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
    activeFilters = { country: "", topic: "", minSeverity: 0 };
    document.getElementById("countryFilter").value = "";
    document.getElementById("topicFilter").value = "";
    document.getElementById("severityFilter").value = "0";
    render();
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
    if (activeFilters.country && !(ev.countries || []).includes(activeFilters.country)) return false;
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
    <span class="popup-link" id="edit-${ev.id}">Open / edit</span>
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

/* ---- Modal / form ---- */

function openModal(ev = null) {
  const form = document.getElementById("eventForm");
  form.reset();
  document.getElementById("deleteEvent").classList.toggle("hidden", !ev);

  if (ev) {
    document.getElementById("modalTitle").textContent = "Edit event";
    document.getElementById("eventId").value = ev.id;
    document.getElementById("eventLat").value = ev.lat;
    document.getElementById("eventLng").value = ev.lng;
    document.getElementById("fTitle").value = ev.title || "";
    document.getElementById("fDate").value = ev.date || "";
    document.getElementById("fSeverity").value = ev.severity ?? 2;
    document.getElementById("fLocation").value = ev.location || "";
    document.getElementById("fCountries").value = (ev.countries || []).join(", ");
    document.getElementById("fTopics").value = (ev.topics || []).join(", ");
    document.getElementById("fSummary").value = ev.summary || "";
    document.getElementById("fNotes").value = ev.notes || "";
    document.getElementById("fLinks").value = (ev.links || []).join(", ");
  } else {
    document.getElementById("modalTitle").textContent = "New event";
    document.getElementById("eventId").value = "";
    document.getElementById("eventLat").value = pendingLatLng ? pendingLatLng.lat : "";
    document.getElementById("eventLng").value = pendingLatLng ? pendingLatLng.lng : "";
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
  const id = document.getElementById("eventId").value || `ev-${Date.now()}`;
  const newEvent = {
    id,
    title: document.getElementById("fTitle").value.trim(),
    date: document.getElementById("fDate").value,
    severity: parseInt(document.getElementById("fSeverity").value, 10),
    location: document.getElementById("fLocation").value.trim(),
    lat: parseFloat(document.getElementById("eventLat").value),
    lng: parseFloat(document.getElementById("eventLng").value),
    countries: splitList(document.getElementById("fCountries").value),
    topics: splitList(document.getElementById("fTopics").value),
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
  // Rebuild filter dropdowns to include any newly typed countries/topics,
  // preserving current selection.
  const countrySel = document.getElementById("countryFilter");
  const topicSel = document.getElementById("topicFilter");
  const curCountry = countrySel.value;
  const curTopic = topicSel.value;
  countrySel.innerHTML = `<option value="">All countries</option>`;
  topicSel.innerHTML = `<option value="">All topics</option>`;
  buildFilterOptions();
  countrySel.value = curCountry;
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
