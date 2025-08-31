const ADMIN_PASSWORD = "letmein123"; // change this
const REPO_DATA_URL = "data/solutions.json";

// Originals vs working copy
let ORIGINAL = null;
let DATA = null;
let dirty = false;
let changeList = [];

// Gate
const gate = document.getElementById("gate");
const adminUI = document.getElementById("adminUI");
const enterBtn = document.getElementById("enterBtn");
const pwInput = document.getElementById("pw");

// Top bar
const statusEl = document.getElementById("status");
const lastLoadedEl = document.getElementById("lastLoaded");
const dirtyStateEl = document.getElementById("dirtyState");
const reloadBtn = document.getElementById("reloadBtn");
const discardBtn = document.getElementById("discardBtn");
const saveAllBtn = document.getElementById("saveAllBtn");
const changeLogWrap = document.getElementById("changeLogWrap");
const changeLog = document.getElementById("changeLog");

// Features UI
const categoryList = document.getElementById("categoryList");
const featureList = document.getElementById("featureList");
const selectedFeatId = document.getElementById("selectedFeatId"); // hidden stable id
const featLabel = document.getElementById("featLabel");
const idPreview = document.getElementById("idPreview");
const usedBy = document.getElementById("usedBy");
const addFeatBtn = document.getElementById("addFeatBtn");
const renameFeatBtn = document.getElementById("renameFeatBtn");
const delFeatBtn = document.getElementById("delFeatBtn");

// Solutions UI
const solnCategoryFilter = document.getElementById("solnCategoryFilter");
const solutionsList = document.getElementById("solutionsList");

const s_id = document.getElementById("s_id"); // hidden (auto-generated)
const s_name = document.getElementById("s_name");
const s_category = document.getElementById("s_category");
const s_special = document.getElementById("s_special");
const s_summary = document.getElementById("s_summary");
const s_details = document.getElementById("s_details");
const s_link_product = document.getElementById("s_link_product");
const s_link_paper = document.getElementById("s_link_paper");
const tagPicker = document.getElementById("tagPicker");

const newSolutionBtn = document.getElementById("newSolutionBtn");
const saveSolutionBtn = document.getElementById("saveSolutionBtn");
const deleteSolutionBtn = document.getElementById("deleteSolutionBtn");

// ---------- Gate ----------
enterBtn.addEventListener("click", async () => {
  if (pwInput.value === ADMIN_PASSWORD) {
    gate.classList.add("hidden");
    adminUI.classList.remove("hidden-important");
    await bootstrapFromServer();
  } else {
    alert("Incorrect password");
  }
});

// ---------- Load / Save / Discard ----------
reloadBtn.addEventListener("click", async () => {
  if (dirty && !confirm("You have unsaved changes. Reload and lose them?")) return;
  await bootstrapFromServer();
});
discardBtn.addEventListener("click", () => {
  if (!dirty) { setStatus("No changes to discard"); return; }
  if (!confirm("Discard all unsaved changes and revert to last loaded data?")) return;
  DATA = deepClone(ORIGINAL);
  dirty = false; changeList = [];
  hydrateUI();
  renderDirty();
  setStatus("Reverted to last loaded data");
});
saveAllBtn.addEventListener("click", () => {
  if (!dirty) { alert("No changes to save."); return; }
  try { validateData(DATA, true); }
  catch (e) { alert("Fix validation issues before saving:\n" + e.message); return; }
  if (!confirm("Save all staged changes and export an updated solutions.json?")) return;
  downloadJSON(DATA, "solutions.json");
  setStatus("Exported updated solutions.json");
});

// ---------- Init ----------
async function bootstrapFromServer(){
  try{
    setStatus("Loading from /data/solutions.json …");
    const res = await fetch(REPO_DATA_URL, { cache: "no-store" });
    ORIGINAL = await res.json();
    DATA = deepClone(ORIGINAL);
    dirty = false; changeList = [];
    hydrateUI();
    renderDirty();
    setLastLoaded();
    setStatus("Loaded live data");
  }catch(e){
    console.error(e);
    setStatus("Failed to load /data/solutions.json");
    alert("Could not load /data/solutions.json");
  }
}

function setStatus(s){ statusEl.textContent = s; }
function setLastLoaded(){ lastLoadedEl.textContent = `Last loaded: ${new Date().toLocaleString()}`; }
function markDirty(description){ dirty = true; if (description) changeList.push(description); renderDirty(); }
function renderDirty(){
  dirtyStateEl.textContent = dirty ? "Unsaved changes" : "No changes";
  dirtyStateEl.className = "text-xs mt-1 " + (dirty ? "text-amber-400" : "text-neutral-500");
  if (changeList.length){
    changeLogWrap.classList.remove("hidden");
    changeLog.innerHTML = changeList.map(d => `<li>${escapeHTML(d)}</li>`).join("");
  } else {
    changeLogWrap.classList.add("hidden");
    changeLog.innerHTML = "";
  }
}

// ---------- Hydrate UI ----------
function hydrateUI(){
  renderCategories();
  renderCategorySelector(solnCategoryFilter, DATA.categories);
  renderCategorySelector(s_category, DATA.categories);
  if (!window.activeCategory) window.activeCategory = DATA.categories?.[0] || null;
  highlightActiveCategory();
  clearFeatureForm();
  renderFeatureList();
  renderSolutionsList();
  renderTagPicker();
  updateIdPreview();
}

// Features
function renderCategories(){
  categoryList.innerHTML = "";
  (DATA.categories || []).forEach(cat=>{
    const btn = document.createElement("button");
    btn.className = "px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700 hover:bg-neutral-700";
    btn.textContent = cat; btn.dataset.cat = cat;
    btn.addEventListener("click", ()=>{
      window.activeCategory = cat;
      highlightActiveCategory();
      clearFeatureForm();
      renderFeatureList();
      renderTagPicker();
      solnCategoryFilter.value = cat;
      renderSolutionsList();
    });
    categoryList.appendChild(btn);
  });
}
function highlightActiveCategory(){
  [...categoryList.children].forEach(chip=>{
    const on = chip.dataset.cat===window.activeCategory;
    chip.classList.toggle("ring-2", on);
    chip.classList.toggle("ring-emerald-500", on);
  });
}
function renderFeatureList(){
  featureList.innerHTML = "";
  const feats = (DATA.features && DATA.features[window.activeCategory]) || [];
  feats.forEach(f=>{
    const chip = document.createElement("button");
    chip.className = "px-2 py-1 rounded-full text-xs bg-neutral-900 hover:bg-neutral-800 border border-neutral-700";
    chip.textContent = `${f.label}`; // hide id
    chip.addEventListener("click", ()=>{
      selectedFeatId.value = f.id; // locked id
      featLabel.value = f.label;
      updateIdPreview();
      const used = findSolutionsUsingTag(window.activeCategory, f.id);
      usedBy.textContent = used.length ? `Used by ${used.length} solution(s) in ${window.activeCategory}: ${used.map(s=>s.name).join(", ")}` : "Not used by any solutions.";
    });
    featureList.appendChild(chip);
  });
}
function clearFeatureForm(){
  selectedFeatId.value = "";
  featLabel.value = "";
  idPreview.textContent = "New ID will be generated automatically";
  usedBy.textContent = "";
}
function updateIdPreview(){
  if(selectedFeatId.value){
    idPreview.textContent = `Selected feature (ID hidden)`;
  }else{
    idPreview.textContent = `New ID will be generated automatically`;
  }
}

// Add new feature (no confirm)
addFeatBtn.addEventListener("click", e=>{
  e.preventDefault();
  if (!window.activeCategory) return alert("Select a category");
  const label = sTrim(featLabel.value);
  if(!label) return alert("Feature label is required.");
  const idBase = slugify(label);
  if(!idBase) return alert("Could not generate an ID from that label.");
  const list = DATA.features[window.activeCategory] || [];

  // Ensure unique ID
  let id = idBase, n = 2;
  while (list.some(f => f.id === id)) { id = `${idBase}_${n++}`; }

  list.push({ id, label });
  DATA.features[window.activeCategory] = list;

  clearFeatureForm();
  renderFeatureList();
  renderTagPicker();
  markDirty(`Add feature in ${window.activeCategory}`);
  setStatus("New feature staged");
});

// Rename selected (confirm because it changes existing)
renameFeatBtn.addEventListener("click", ()=>{
  if(!window.activeCategory) return alert("Select a category.");
  const id = sTrim(selectedFeatId.value); if(!id) return alert("Select a feature to rename.");
  const label = sTrim(featLabel.value); if(!label) return alert("Feature label is required.");

  const list = DATA.features[window.activeCategory] || [];
  const idx = list.findIndex(f=>f.id===id); if(idx<0) return alert("Feature not found.");

  if(!confirm(`Update label for this existing feature in ${window.activeCategory}?\n\nNew label: ${label}`)) return;

  list[idx].label = label; // ID stays the same
  DATA.features[window.activeCategory] = list;

  clearFeatureForm();
  renderFeatureList();
  renderTagPicker();
  markDirty(`Update feature label in ${window.activeCategory}`);
  setStatus("Feature label update staged");
});

// Delete selected (confirm; auto-remove tag from solutions in THIS category only)
delFeatBtn.addEventListener("click", ()=>{
  if(!window.activeCategory) return;
  const id = sTrim(selectedFeatId.value); if(!id) return alert("Select a feature to delete.");
  const list = DATA.features[window.activeCategory] || [];
  const idx = list.findIndex(f=>f.id===id);
  if(idx<0) return alert("Feature not found.");

  const used = findSolutionsUsingTag(window.activeCategory, id);
  const usedMsg = used.length
    ? `\n\nThis feature is used by ${used.length} solution(s) in ${window.activeCategory}:\n- ${used.map(s=>s.name).join("\n- ")}\n\nIt will be removed from those solutions automatically.`
    : "";

  if(!confirm(`Delete this feature from ${window.activeCategory}?${usedMsg}`)) return;

  // Remove feature from this category
  list.splice(idx,1); DATA.features[window.activeCategory] = list;

  // Remove tag from any solutions in this category that used it
  if (used.length){
    used.forEach(sol=>{
      sol.tags = (sol.tags||[]).filter(t => t !== id);
    });
  }

  clearFeatureForm();
  renderFeatureList();
  renderTagPicker();
  renderSolutionsList();
  markDirty(`Delete feature in ${window.activeCategory}`);
  setStatus("Feature deletion staged");
});

function findSolutionsUsingTag(category, tagId){
  const sols = (DATA.solutions||[]).filter(s => s.category === category);
  return sols.filter(s => Array.isArray(s.tags) && s.tags.includes(tagId));
}

// Solutions
function renderCategorySelector(select, categories){
  select.innerHTML = "";
  (categories || []).forEach(cat=>{
    const opt = document.createElement("option");
    opt.value=cat; opt.textContent=cat; select.appendChild(opt);
  });
}
function renderSolutionsList(){
  solutionsList.innerHTML = "";
  const cat = solnCategoryFilter.value || window.activeCategory;
  const sols = (DATA.solutions || []).filter(s=>s.category===cat);
  sols.forEach(s=>{
    const btn = document.createElement("button");
    btn.className = "w-full p-3 rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-left";
    btn.innerHTML = `<div class="flex items-center justify-between">
      <div><div class="font-semibold">${escapeHTML(s.name)}</div>
      <div class="text-xs text-neutral-400">${escapeHTML(s.category)}</div></div>
      <div class="text-xs text-neutral-300">${(s.tags||[]).length} tag(s)</div></div>`;
    btn.addEventListener("click", ()=>loadSolutionIntoForm(s.id));
    solutionsList.appendChild(btn);
  });
}
solnCategoryFilter.addEventListener("change", ()=>{
  window.activeCategory = solnCategoryFilter.value;
  highlightActiveCategory();
  renderFeatureList();
  renderSolutionsList();
  renderTagPicker();
});

function loadSolutionIntoForm(id){
  const s = (DATA.solutions || []).find(x=>x.id===id); if(!s) return;
  window.selectedSolutionId = s.id;
  s_id.value=s.id;                 // hidden, immutable during edit
  s_name.value=s.name||"";
  s_category.value=s.category||DATA.categories?.[0]||"";
  s_special.value=s.special_block||"";
  s_summary.value=s.summary||"";
  s_details.value=(Array.isArray(s.details)?s.details:[]).join("\n");
  s_link_product.value=(s.links&&s.links.product)||"";
  s_link_paper.value=(s.links&&s.links.paperwork)||"";
  renderTagPicker();
  const current = new Set(s.tags||[]);
  [...tagPicker.querySelectorAll("input[type=checkbox]")].forEach(cb=>cb.checked=current.has(cb.value));
}

function renderTagPicker(){
  tagPicker.innerHTML = "";
  const cat = s_category.value || window.activeCategory || DATA.categories?.[0];
  const feats = (DATA.features && DATA.features[cat]) || [];
  feats.forEach(f=>{
    const label = document.createElement("label");
    label.className = "flex items-center gap-2 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs";
    label.innerHTML = `<input type="checkbox" value="${escapeHTML(f.id)}" class="h-3 w-3 rounded border-neutral-600 bg-neutral-900">
      <span>${escapeHTML(f.label)}</span>`;
    tagPicker.appendChild(label);
  });
}
s_category.addEventListener("change", renderTagPicker);

// New Solution
newSolutionBtn.addEventListener("click", ()=>{
  window.selectedSolutionId = null;
  s_id.value = ""; // no id yet; will generate on save
  s_name.value = "";
  s_category.value = window.activeCategory || (DATA.categories?.[0] || "");
  s_special.value = "";
  s_summary.value = "";
  s_details.value = "";
  s_link_product.value = "";
  s_link_paper.value = "";
  renderTagPicker();
});

// Add/Update/Delete Solution
saveSolutionBtn.addEventListener("click", e=>{
  e.preventDefault();
  try{
    const s = collectSolutionFromForm();
    const exists = (DATA.solutions||[]).find(x=>x.id===s.id);
    const verb = exists ? "Update" : "Add";
    // Confirm ONLY if updating
    if (exists) {
      if (!confirm(`Update this existing solution?\n\n${s.name}`)) return;
    }
    upsertSolution(s);
    renderSolutionsList();
    markDirty(`${verb} solution`);
    setStatus(`Solution ${verb.toLowerCase()} staged`);
  } catch(err){ alert(err.message); }
});

deleteSolutionBtn.addEventListener("click", ()=>{
  const id = sTrim(s_id.value); if(!id) return alert("Load a solution first (click it in the list).");
  const idx = (DATA.solutions||[]).findIndex(x=>x.id===id);
  if(idx<0) return alert("Solution not found.");
  if(!confirm(`Delete this solution?`)) return;
  DATA.solutions.splice(idx,1);
  // reset form
  newSolutionBtn.click();
  renderSolutionsList();
  markDirty(`Delete solution`);
  setStatus("Solution deletion staged");
});

// Collect & Upsert
function collectSolutionFromForm(){
  let id = sTrim(s_id.value);        // hidden and may be empty for brand new
  const name = sTrim(s_name.value);
  const category = sTrim(s_category.value);

  if(!name || !category) throw new Error("Name and Category are required.");

  // Auto-generate ID if this is a new solution
  if (!id) {
    const base = slugify(name);
    if (!base) throw new Error("Could not generate an ID from Name; please try a different Name.");
    id = uniqueSolutionId(base);
  }

  // Prevent collision only when creating a *new* record
  const exists = (DATA.solutions||[]).find(x=>x.id===id);
  if(exists && window.selectedSolutionId!==id) throw new Error(`Solution ID already exists (derived from Name). Try a different Name.`);

  const tags = [...tagPicker.querySelectorAll("input[type=checkbox]:checked")].map(cb=>cb.value);
  const details = s_details.value.split("\n").map(x=>x.trim()).filter(Boolean);
  const links = { product:sTrim(s_link_product.value), paperwork:sTrim(s_link_paper.value) };
  const special_block = sTrim(s_special.value) || undefined;

  // Category-safe tags
  const feats = (DATA.features && DATA.features[category]) || [];
  const allowed = new Set(feats.map(f=>f.id));
  const bad = tags.filter(t=>!allowed.has(t));
  if (bad.length) throw new Error(`These tags are not valid in ${category}: ${bad.join(", ")}`);

  // Write back the generated/locked id (still hidden)
  s_id.value = id;

  return { id, name, category, tags, summary:s_summary.value, details, links, ...(special_block?{special_block}:{}) };
}

function upsertSolution(s){
  if(!Array.isArray(DATA.solutions)) DATA.solutions=[];
  const i=DATA.solutions.findIndex(x=>x.id===s.id);
  if(i>=0) DATA.solutions[i]=s; else DATA.solutions.push(s);
}

// ---------- Validation & Utils ----------
function validateData(obj, strict=false){
  if(typeof obj!=="object"||!obj) throw new Error("Root must be an object.");
  if(!Array.isArray(obj.categories)) throw new Error("categories must be an array.");
  if(typeof obj.features!=="object"||!obj.features) throw new Error("features must be an object.");
  if(!Array.isArray(obj.solutions)) throw new Error("solutions must be an array.");
  obj.categories.forEach(cat=>{
    if(!Array.isArray(obj.features[cat])){
      if(strict) throw new Error(`features missing array for ${cat}`);
      obj.features[cat]=[];
    }
  });
  for(const cat of Object.keys(obj.features)){
    const seen=new Set();
    obj.features[cat].forEach(f=>{
      if(!f.id||!f.label) throw new Error(`Feature missing id/label in ${cat}`);
      if(seen.has(f.id)) throw new Error(`Duplicate feature id in ${cat}`);
      seen.add(f.id);
    });
  }
  const seenSol=new Set();
  obj.solutions.forEach(s=>{
    if(!s.id||!s.name||!s.category) throw new Error("Each solution needs id (hidden), name, category");
    if(seenSol.has(s.id)) throw new Error(`Duplicate solution id "${s.id}"`);
    const feats = (obj.features && obj.features[s.category]) || [];
    const allowed = new Set(feats.map(f=>f.id));
    (s.tags||[]).forEach(t=>{
      if(!allowed.has(t)) throw new Error(`Solution "${s.name}" has an invalid tag for "${s.category}"`);
    });
    seenSol.add(s.id);
  });
}
function deepClone(x){ return JSON.parse(JSON.stringify(x)); }
function sTrim(v){ return String(v||"").trim(); }
function downloadJSON(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href:url, download:filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function escapeHTML(s){ return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;"," >":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function slugify(label){
  return String(label||"")
    .toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}
function uniqueSolutionId(base){
  let id = base, n = 2;
  const list = DATA.solutions || [];
  while (list.some(s => s.id === id)) id = `${base}_${n++}`;
  return id;
}
