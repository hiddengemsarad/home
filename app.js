// --- Config ---
const DATA_URL = "data/monuments.geojson";

// Link înscriere / trimitere (același ca pe home)
const SUBMIT_URL = "https://forms.gle/FskENUpS3Z62T45D9"; // TODO: Google Form / Drive upload
const ABOUT_HTML = `
  <p>
    Aceasta este <b>Harta Virtuală</b> a concursului <b>Hidden Gems of Arad</b>.
    Fiecare punct reprezintă un monument; în popup găsești clipul câștigător.
  </p>
  <ul>
    <li>Video: recomandat YouTube „Unlisted”</li>
    <li>Date: <code>data/monuments.geojson</code></li>
    <li>Ordinea coordonatelor în GeoJSON: <b>[LONG, LAT]</b></li>
  </ul>
`;

// --- UI helpers ---
const $ = (id) => document.getElementById(id);

function openModal(title, html){
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = html;
  $("modal").classList.add("show");
  $("modal").setAttribute("aria-hidden", "false");
}
function closeModal(){
  $("modal").classList.remove("show");
  $("modal").setAttribute("aria-hidden", "true");
}

// --- Map init (Arad) ---
const map = L.map("map", { zoomControl: true }).setView([46.1667, 21.3167], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Cluster group
const cluster = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 46
});
map.addLayer(cluster);

let allFeatures = [];
let markers = [];

function uniqSorted(arr){
  return [...new Set(arr.filter(Boolean))].sort((a,b) => {
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b), "ro");
  });
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPopup(props){
  const name = escapeHtml(props.name || "Monument");
  const category = escapeHtml(props.category || "");
  const prize = escapeHtml(props.prize || props.winner || "");
  const school = escapeHtml(props.school || "");
  const year = escapeHtml(props.year || "");
  const notes = escapeHtml(props.notes || "");
  const youtubeId = (props.youtubeId || "").trim();

  const metaParts = [
    category && `<span><b>Categorie:</b> ${category}</span>`,
    year && `<span><b>An:</b> ${year}</span>`,
    prize && `<span><b>Premiu:</b> ${prize}</span>`,
    school && `<span><b>Școala:</b> ${school}</span>`,
  ].filter(Boolean).join(" ");

  const videoHtml = youtubeId
    ? `<iframe class="video"
        src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}"
        title="Clip câștigător"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen></iframe>`
    : `<div class="desc"><i>Nu există video pentru acest punct încă.</i></div>`;

  const descHtml = notes ? `<div class="desc">${notes}</div>` : "";

  return `
    <div class="popup">
      <h3>${name}</h3>
      <div class="meta">${metaParts || ""}</div>
      ${descHtml}
      ${videoHtml}
      <div class="linkrow">
        <a href="https://www.google.com/maps?q=${encodeURIComponent(name)}%20Arad" target="_blank" rel="noopener">Caută pe Google Maps</a>
      </div>
    </div>
  `;
}

function matchesFilters(props, query, year, prize, category){
  const q = query.trim().toLowerCase();
  const name = String(props.name || "").toLowerCase();
  const notes = String(props.notes || "").toLowerCase();

  const okQuery = !q || name.includes(q) || notes.includes(q);
  const okYear = !year || String(props.year || "") === String(year);
  const okPrize = !prize || String(props.prize || props.winner || "") === String(prize);
  const okCategory = !category || String(props.category || "") === String(category);

  return okQuery && okYear && okPrize && okCategory;
}

function refreshMarkers(){
  const query = $("search").value || "";
  const year = $("filterYear").value || "";
  const prize = $("filterPrize").value || "";
  const category = $("filterCategory").value || "";

  cluster.clearLayers();

  const visible = markers.filter(m =>
    matchesFilters(m.props, query, year, prize, category)
  );

  visible.forEach(m => cluster.addLayer(m.marker));

  if (visible.length > 0){
    const group = L.featureGroup(visible.map(v => v.marker));
    map.fitBounds(group.getBounds().pad(0.15));
  }
}

function fillSelectOptions(){
  const years = uniqSorted(allFeatures.map(f => f.properties?.year));
  const prizes = uniqSorted(allFeatures.map(f => f.properties?.prize || f.properties?.winner));
  const categories = uniqSorted(allFeatures.map(f => f.properties?.category));

  years.forEach(y => {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    $("filterYear").appendChild(opt);
  });

  prizes.forEach(p => {
    const opt = document.createElement("option");
    opt.value = String(p);
    opt.textContent = String(p);
    $("filterPrize").appendChild(opt);
  });

  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = String(c);
    opt.textContent = String(c);
    $("filterCategory").appendChild(opt);
  });
}

async function loadData(){
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Nu pot încărca ${DATA_URL} (${res.status})`);
  const geo = await res.json();

  const features = geo.features || [];
  allFeatures = features;

  markers = features.map((feature) => {
    const coords = feature.geometry?.coordinates;
    const props = feature.properties || {};
    if (!coords || coords.length < 2) return null;

    const lng = Number(coords[0]);
    const lat = Number(coords[1]);

    const marker = L.marker([lat, lng]);
    marker.bindPopup(buildPopup(props), { maxWidth: 420 });

    return { marker, props, feature };
  }).filter(Boolean);

  fillSelectOptions();
  refreshMarkers();
}

// --- Events ---
$("search").addEventListener("input", () => refreshMarkers());
$("filterYear").addEventListener("change", () => refreshMarkers());
$("filterPrize").addEventListener("change", () => refreshMarkers());
$("filterCategory").addEventListener("change", () => refreshMarkers());

$("reset").addEventListener("click", () => {
  $("search").value = "";
  $("filterYear").value = "";
  $("filterPrize").value = "";
  $("filterCategory").value = "";
  refreshMarkers();
});

$("openAbout").addEventListener("click", (e) => {
  e.preventDefault();
  openModal("Despre", ABOUT_HTML);
});

$("openSubmit").addEventListener("click", (e) => {
  e.preventDefault();
  if (SUBMIT_URL && SUBMIT_URL !== "https://example.com") {
    window.open(SUBMIT_URL, "_blank", "noopener");
  } else {
    openModal("Înscriere / Trimitere lucrări", `
      <p>Setează linkul către formular / încărcare în <code>app.js</code> (SUBMIT_URL).</p>
    `);
  }
});

$("closeModal").addEventListener("click", () => closeModal());
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// Start
loadData().catch(err => {
  console.error(err);
  openModal("Eroare", `<p>Nu am putut încărca datele: <code>${escapeHtml(err.message)}</code></p>`);
});
