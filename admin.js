/* Admin for Merchant Solutions Data
   - Password gate (lightweight)
   - Import JSON file or load from /data/solutions.json
   - Edit categories' features
   - Add/Edit/Delete solutions
   - Export JSON
*/

const ADMIN_PASSWORD = "letmein123"; // change to whatever you like
const REPO_DATA_URL = "/data/solutions.json";

let DATA = null;
let activeCategory = null;
let selectedSolutionId = null;

/* Elements */
const gate = document.getElementById("gate");
const adminUI = document.getElementById("adminUI");
const enterBtn = document.getElementById("enterBtn");
const pwInput = document.getElementById("pw");

const importFile = document.getElementById("importFile");
const exportBtn = document.getElementById("exportBtn");
const loadRepoBtn = document.getElementById("loadRepoBtn");
const statusEl = document.getElementById("status");

const categoryList = document.getElementById("categoryList");
const featureList = document.getElementById("featureList");
const featId = document.getElementById("featId");
const featLabel = document.getElementById("featLabel");
const addFeatBtn = document.getElementById("addFeatBtn");
const delFeatBtn = document.getElementById("delFeatBtn");

const solnCategoryFilter = document.getElementById("solnCategoryFilter");
const solutionsList = document.getElementById("solutionsList");

const s_id = document.getElementById("s_id");
const s_name = document.getElementById("s_name");
const s_category = document.getElementById("s_category");
const s_special = document.getElementById("s_special");
const s_summary = document.getElementById("s_summary");
const s_details = document.getElementById("s_details");
const s_link_product = document.getElementById("s_link_product");
const s_link_paper = document.getElementById("s_link_paper");
const tagPicker = document.getElementById("tagPicker");

const saveSolutionBtn = document.getElementById("saveSolutionBtn");
const deleteSolutionBtn = document.getElementById("deleteSolutionBtn");
const clearFormBtn = document.getElementById("clearFormBtn");

/* Gate */
enterBtn.addEventListener("click", () => {
  if (pwInput.value === ADMIN_PASSWORD) {
    gate.classList.add("hidden");
    adminUI.classList.remove("hidden-important");
    if (!DATA) bootstrapData(); // load repo JSON by default
  } else {
    alert("Incorrect password");
  }
});

/* Data loading */
loadRepoBtn.addEventListener("click", bootstrapData);
importFile.addEventListener("change", handleImportFile);
exportBtn.addEventListener("click", handleExport);

async function bootstrapData() {
  try {
    const res = await fetch(REPO_DATA_URL, { cache: "no-store" });
    DATA = await res.json();
    status("Loaded /data/solutions.json");
    hydrateUI();
  } catch (e) {
    console.error(e);
    status("Failed to load /data/solutions.json");
    alert("Could not load /data/solutions.json");
  }
}

function handleImportFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(String(reader.result));
      validateData(obj, true);
      DATA = obj;
      status(`Imported ${file.name}`);
      hydrateUI();
    } catch (err) {
      console.error(err);
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
}

function handleExport() {
  try {
    validateData(DATA, true);
  } catch (e) {
    alert("Fix validation issues before exporting:\n" + e.message);
    return;
  }
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "solutions.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  status("Exported solutions.json");
}

function status(s) { statusEl.textContent = s; }

/* UI Hydration */
function hydrateUI() {
  // Categories dropdowns and chips
  renderCategories();
  renderCategorySelector(solnCategoryFilter, DATA.categories);
  renderCategorySelector(s_category, DATA.categories);

  // Default active category for features
  if (!activeCategory) activeCategory = DATA.categories?.[0] || null;
  highlightActiveCategory();
  renderFeatureList();

  // Solutions list
  renderSolutionsList();
  renderTagPicker();
}

/* Categories & Features */
function renderCategories() {
  categoryList.innerHTML = "";
  (DATA.categories || []).forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700 hover:bg-neutral-700";
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      highlightActiveCategory();
      renderFeatureList();
      renderTagPicker();
      solnCategoryFilter.value = cat;
      renderSolutionsList();
    });
    btn.dataset.cat = cat;
    categoryList.appendChild(btn);
  });
}

function highlightActiveCategory() {
  [...categoryList.children].forEach(chip => {
    if (chip.dataset.cat === activeCategory) {
      chip.classList.add("ring-2","ring-emerald-500");
    } else {
      chip.classList.remove("ring-2","ring-emerald-500");
    }
  });
}

function renderFeatureList() {
  featureList.innerHTML = "";
  const feats = (DATA.features && DATA.features[activeCategory]) || [];
  feats.forEach(f => {
    const chip = document.createElement("button");
    chip.className = "chip px-2 py-1 rounded-full text-xs bg-neutral-900 hover:bg-neutral-800 border border-neutral-700";
    chip.textContent = `${f.label} (${f.id})`;
    chip.addEventListener("click", () => {
      featId.value = f.id;
      featLabel.value = f.label;
    });
    featureList.appendChild(chip);
  });
}

addFeatBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (!activeCategory) return alert("Select a category");
  const id = sTrim(featId.value);
  const label = sTrim(featLabel.value);
  if (!id || !label) return alert("Feature ID and Label are required.");

  const list = DATA.features[activeCategory] || [];
  const idx = list.findIndex(f => f.id === id);
  if (idx >= 0) {
    list[idx].label = label;
  } else {
    list.push({ id, label });
  }
  DATA.features[activeCategory] = list;
  featId.value = ""; featLabel.value = "";
  renderFeatureList(); renderTagPicker();
  status("Feature added/updated");
});

delFeatBtn.addEventListener("click", () => {
  if (!activeCategory) return;
  const id = sTrim(featId.value);
  if (!id) return alert("Enter Feature ID to delete.");
  const list = DATA.features[activeCategory] || [];
  const idx = list.findIndex(f => f.id === id);
  if (idx < 0) return alert("Feature not found.");
  if (!confirm(`Delete feature "${id}" from ${activeCategory}?`)) return;
  list.splice(idx, 1);
  DATA.features[activeCategory] = list;
  featId.value = ""; featLabel.value = "";
  renderFeatureList(); renderTagPicker();
  status("Feature deleted");
});

/* Solutions */
function renderCategorySelector(select, categories) {
  select.innerHTML = "";
  (categories || []).forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat; opt.textContent = cat;
    select.appendChild(opt);
  });
}

function renderSolutionsList() {
  solutionsList.innerHTML = "";
  const cat = solnCategoryFilter.value || activeCategory;
  const sols = (DATA.solutions || []).filter(s => s.category === cat);
  sols.forEach(s => {
    const btn = document.createElement("button");
    btn.className = "card w-full p-3 rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-left";
    btn.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="font-semibold">${escapeHTML(s.name)}</div>
          <div class="text-xs text-neutral-400">${escapeHTML(s.id)} • ${escapeHTML(s.category)}</div>
        </div>
        <div class="text-xs text-neutral-300">${(s.tags||[]).length} tag(s)</div>
      </div>
    `;
    btn.addEventListener("click", () => loadSolutionIntoForm(s.id));
    solutionsList.appendChild(btn);
  });
}

solnCategoryFilter.addEventListener("change", () => {
  activeCategory = solnCategoryFilter.value;
  highlightActiveCategory();
  renderFeatureList();
  renderSolutionsList();
  renderTagPicker();
});

/* Solution form load/save/delete/clear */
function loadSolutionIntoForm(id) {
  const s = (DATA.solutions || []).find(x => x.id === id);
  if (!s) return;
  selectedSolutionId = s.id;
  s_id.value = s.id;
  s_name.value = s.name || "";
  s_category.value = s.category || (DATA.categories?.[0] || "");
  s_special.value = s.special_block || "";
  s_summary.value = s.summary || "";
  s_details.value = (Array.isArray(s.details) ? s.details : []).join("\n");
  s_link_product.value = (s.links && s.links.product) || "";
  s_link_paper.value = (s.links && s.links.paperwork) || "";

  // tags
  renderTagPicker();
  // Check the ones present
  const current = new Set(s.tags || []);
  [...tagPicker.querySelectorAll("input[type=checkbox]")].forEach(cb => {
    cb.checked = current.has(cb.value);
  });
}

function renderTagPicker() {
  tagPicker.innerHTML = "";
  const cat = s_category.value || activeCategory || DATA.categories?.[0];
  const feats = (DATA.features && DATA.features[cat]) || [];
  feats.forEach(f => {
    const id = `tag_${f.id}`;
    const label = document.createElement("label");
    label.className = "flex items-center gap-2 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs";
    label.innerHTML = `
      <input type="checkbox" id="${id}" value="${escapeHTML(f.id)}" class="h-3 w-3 rounded border-neutral-600 bg-neutral-900">
      <span>${escapeHTML(f.label)}<span class="text-neutral-500"> (${escapeHTML(f.id)})</span></span>
    `;
    tagPicker.appendChild(label);
  });
}

s_category.addEventListener("change", () => {
  renderTagPicker();
});

saveSolutionBtn.addEventListener("click", (e) => {
  e.preventDefault();
  try {
    const s = collectSolutionFromForm();
    upsertSolution(s);
    renderSolutionsList();
    status("Solution added/updated");
  } catch (err) {
    alert(err.message);
  }
});

deleteSolutionBtn.addEventListener("click", () => {
  const id = sTrim(s_id.value);
  if (!id) return alert("Enter the ID of the solution to delete.");
  const idx = (DATA.solutions || []).findIndex(x => x.id === id);
  if (idx < 0) return alert("Solution not found.");
  if (!confirm(`Delete solution "${id}"?`)) return;
  DATA.solutions.splice(idx, 1);
  clearForm();
  renderSolutionsList();
  status("Solution deleted");
});

clearFormBtn.addEventListener("click", clearForm);
function clearForm() {
  selectedSolutionId = null;
  s_id.value = "";
  s_name.value = "";
  s_category.value = DATA.categories?.[0] || "";
  s_special.value = "";
  s_summary.value = "";
  s_details.value = "";
  s_link_product.value = "";
  s_link_paper.value = "";
  renderTagPicker();
}

/* Helpers */
function collectSolutionFromForm() {
  const id = sTrim(s_id.value);
  const name = sTrim(s_name.value);
  const category = sTrim(s_category.value);
  if (!id || !name || !category) throw new Error("ID, Name, and Category are required.");

  // validate unique id (unless updating same)
  const exists = (DATA.solutions || []).find(x => x.id === id);
  if (exists && selectedSolutionId !== id) {
    throw new Error(`Solution ID "${id}" already exists.`);
  }

  const tags = [...tagPicker.querySelectorAll("input[type=checkbox]:checked")].map(cb => cb.value);
  const details = s_details.value.split("\n").map(x => x.trim()).filter(Boolean);
  const links = {
    product: sTrim(s_link_product.value),
    paperwork: sTrim(s_link_paper.value),
  };
  const summary = s_summary.value;
  const special_block = sTrim(s_special.value) || undefined;

  return { id, name, category, tags, summary, details, links, ...(special_block ? {special_block}: {}) };
}

function upsertSolution(s) {
  if (!Array.isArray(DATA.solutions)) DATA.solutions = [];
  const idx = DATA.solutions.findIndex(x => x.id === s.id);
  if (idx >= 0) DATA.solutions[idx] = s;
  else DATA.solutions.push(s);
}

function validateData(obj, strict=false) {
  if (typeof obj !== "object" || !obj) throw new Error("Root must be an object.");
  if (!Array.isArray(obj.categories)) throw new Error("categories must be an array.");
  if (typeof obj.features !== "object" || !obj.features) throw new Error("features must be an object keyed by category.");
  if (!Array.isArray(obj.solutions)) throw new Error("solutions must be an array.");

  // Ensure each category exists in features
  obj.categories.forEach(cat => {
    if (!Array.isArray(obj.features[cat])) {
      if (strict) throw new Error(`features missing array for category: ${cat}`);
      obj.features[cat] = [];
    }
  });

  // Unique ids for features per category
  for (const cat of Object.keys(obj.features)) {
    const seen = new Set();
    obj.features[cat].forEach(f => {
      if (!f.id || !f.label) throw new Error(`Feature missing id/label in ${cat}`);
      if (seen.has(f.id)) throw new Error(`Duplicate feature id "${f.id}" in ${cat}`);
      seen.add(f.id);
    });
  }

  // Unique solution ids
  const seenSol = new Set();
  obj.solutions.forEach(s => {
    if (!s.id || !s.name || !s.category) throw new Error("Each solution needs id, name, category");
    if (seenSol.has(s.id)) throw new Error(`Duplicate solution id "${s.id}"`);
    seenSol.add(s.id);
  });
}

function sTrim(v) { return String(v || "").trim(); }
function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
