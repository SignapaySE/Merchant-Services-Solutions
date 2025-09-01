const ADMIN_PASSWORD = "letmein123"; // change me
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

// Preview & diagnostics
const previewBtn = document.getElementById("previewBtn");
const clearPreviewBtn = document.getElementById("clearPreviewBtn");
const diagnosticsBtn = document.getElementById("diagnosticsBtn");

// Features UI
const categoryList = document.getElementById("categoryList");
const featureList = document.getElementById("featureList");
const selectedFeatId = document.getElementById("selectedFeatId");
const featLabel = document.getElementById("featLabel");
const idPreview = document.getElementById("idPreview");
const usedBy = document.getElementById("usedBy");
const addFeatBtn = document.getElementById("addFeatBtn");
const renameFeatBtn = document.getElementById("renameFeatBtn");
const delFeatBtn = document.getElementById("delFeatBtn");

// Solutions UI
const solnCategoryFilter = document.getElementById("solnCategoryFilter");
const solutionsList = document.getElementById("solutionsList");

const s_id = document.getElementById("s_id");
const s_name = document.getElementById("s_name");
const s_category = document.getElementById("s_category");
const s_summary = document.getElementById("s_summary");
const s_details = document.getElementById("s_details");
const s_link_product = document.getElementById("s_link_product");
const s_link_paper = document.getElementById("s_link_paper");
const tagPicker = document.getElementById("tagPicker");

// Extras editor
const addExtraBtn = document.getElementById("addExtraBtn");
const convertLegacyBtn = document.getElementById("convertLegacyBtn");
const extrasEditor = document.getElementById("extrasEditor");

// Actions
const newSolutionBtn = document.getElementById("newSolutionBtn");
const saveSolutionBtn = document.getElementById("saveSolutionBtn");
const deleteSolutionBtn = document.getElementById("deleteSolutionBtn");

// Mode banner
const solMode = document.getElementById("solMode");
function setSolutionMode(mode, name = "") {
  if (mode === "new") {
    solMode.textContent = "Mode: New Solution";
    solMode.className = "mb-2 text-xs text-emerald-300";
  } else if (mode === "edit") {
    solMode.textContent = `Editing: ${name}`;
    solMode.className = "mb-2 text-xs text-blue-300";
  } else {
    solMode.textContent = "";
    solMode.className = "mb-2 text-xs text-neutral-400";
  }
}

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

// Save All (normalize silently, then validate & export)
saveAllBtn.addEventListener("click", () => {
  if (!dirty) { alert("No changes to save."); return; }
  const staged = normalizeDataForRuntime(deepClone(DATA));
  try { validateData(staged, true); }
  catch (e) { alert("Fix validation issues before saving:\n" + e.message); return; }
  if (!confirm("Save all staged changes and export an updated solutions.json?")) return;
  downloadJSON(staged, "solutions.json");
  setStatus("Exported updated solutions.json");
});

// Preview (normalize for this browser only)
previewBtn.addEventListener('click', () => {
  const staged = normalizeDataForRuntime(deepClone(DATA));
  try { validateData(staged, true); }
  catch (e) { alert("Fix validation issues before previewing:\n" + e.message); return; }
  localStorage.setItem('solutions_preview_enabled', '1');
  localStorage.setItem('solutions_preview_data', JSON.stringify(staged));
  setStatus("Preview enabled for this browser. Open the main app and refresh.");
  alert("Preview saved.\nOpen the main app in THIS browser and refresh.");
});
clearPreviewBtn.addEventListener('click', () => {
  localStorage.removeItem('solutions_preview_enabled');
  localStorage.removeItem('solutions_preview_data');
  setStatus("Preview cleared for this browser.");
  alert("Preview cleared.\nThe main app will use the live data file again after refresh.");
});

// Diagnostics
diagnosticsBtn?.addEventListener("click", () => {
  if (!DATA) return alert("Load data first.");
  const staged = deepClone(DATA);
  const report = analyzeInvalidTags(staged);
  if (!report.length) {
    alert("Diagnostics: No invalid tags found. All solution tags match their category features.");
  } else {
    alert("Diagnostics (no changes applied):\n\n" + report.join("\n"));
  }
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
  setSolutionMode("new");
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
    chip.textContent = `${f.label}`;
    chip.addEventListener("click", ()=>{
      selectedFeatId.value = f.id;
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

// Add / Rename / Delete Features
addFeatBtn.addEventListener("click", e=>{
  e.preventDefault();
  if (!window.activeCategory) return alert("Select a category");
  const label = sTrim(featLabel.value);
  if(!label) return alert("Feature label is required.");
  const idBase = slugify(label);
  if(!idBase) return alert("Could not generate an ID from that label.");
  const list = DATA.features[window.activeCategory] || [];
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
renameFeatBtn.addEventListener("click", ()=>{
  if(!window.activeCategory) return alert("Select a category.");
  const id = sTrim(selectedFeatId.value); if(!id) return alert("Select a feature to rename.");
  const label = sTrim(featLabel.value); if(!label) return alert("Feature label is required.");
  const list = DATA.features[window.activeCategory] || [];
  const idx = list.findIndex(f=>f.id===id); if(idx<0) return alert("Feature not found.");
  if(!confirm(`Update label for this existing feature in ${window.activeCategory}?\n\nNew label: ${label}`)) return;
  list[idx].label = label;
  DATA.features[window.activeCategory] = list;
  clearFeatureForm();
  renderFeatureList();
  renderTagPicker();
  markDirty(`Update feature label in ${window.activeCategory}`);
  setStatus("Feature label update staged");
});
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
  list.splice(idx,1); DATA.features[window.activeCategory] = list;
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
  const s = (DATA.solutions || []).find(x => x.id === id);
  if (!s) return;
  window.selectedSolutionId = s.id;
  s_id.value         = s.id || "";
  s_name.value       = s.name || "";
  s_category.value   = s.category || DATA.categories?.[0] || "";
  s_summary.value    = s.summary || "";
  s_details.value    = (Array.isArray(s.details) ? s.details : []).join("\n");
  s_link_product.value = (s.links && s.links.product) || "";
  s_link_paper.value   = (s.links && s.links.paperwork) || "";

  renderTagPicker();
  const current = new Set(s.tags || []);
  [...tagPicker.querySelectorAll("input[type=checkbox]")].forEach(cb => { cb.checked = current.has(cb.value); });

  // Extras
  renderExtrasEditorUI(s.extras || []);

  setSolutionMode("edit", s.name || "");
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
s_category.addEventListener("change", ()=>{
  renderTagPicker();
  // keep extras as-is; they are not category-specific
});

// ---------- EXTRAS EDITOR ----------
addExtraBtn.addEventListener("click", ()=>{
  const arr = getExtrasFromUI();
  arr.push({ title: "", style: "cards-2col", description: "", items: [] });
  renderExtrasEditorUI(arr);
  markDirty("Add extras section");
  setStatus("Extras section added");
});

convertLegacyBtn.addEventListener("click", ()=>{
  // If the currently loaded solution has a legacy special_block,
  // convert it into an editable 'extras' section with prefilled items.
  const id = window.selectedSolutionId;
  if (!id) return alert("Load a solution first.");
  const s = DATA.solutions.find(x=>x.id===id);
  if (!s) return;
  if (!s.special_block) return alert("No legacy block to convert on this solution.");

  const extras = s.extras || [];
  if (s.special_block === "terminalDetails") {
    extras.push({
      title: "Available SignaPay terminal models",
      style: "cards-2col",
      description: "Countertop and wireless options with EMV/NFC.",
      items: [
        { title: "Valor VL100 / VL100 Pro", subtitle: "Countertop · EMV, NFC, Wi-Fi/Ethernet", url: "https://valorpaytech.com/what-we-do/hardware-products/countertop-pos/vl100-pro/" },
        { title: "Dejavoo QD4", subtitle: "Android countertop · EMV, NFC, Ethernet/Wi-Fi", url: "https://dejavoo.io/products/qd-terminals-family/qd4/" },
        { title: "PAX A80", subtitle: "Android countertop · EMV, NFC, Ethernet/Wi-Fi", url: "https://www.paxtechnology.com/a80" },
        { title: "Dejavoo P3 (Wireless)", subtitle: "Handheld LTE/Wi-Fi · EMV, NFC, built-in printer", url: "https://dejavoo.io/products/p-terminals-family/p3/" }
      ]
    });
  } else if (s.special_block === "shift4Details") {
    extras.push({
      title: "Shift4 desktop terminals",
      style: "cards-2col",
      description: "Countertop EMV/NFC terminals with receipt printing.",
      items: [
        { title: "Shift4 Terminals", subtitle: "Secure EMV chip, PIN, contactless, receipt printing", url: "https://www.shift4network.com/credit-card-terminals/" }
      ]
    });
  } else {
    return alert(`Unknown legacy block "${s.special_block}".`);
  }

  s.extras = extras;
  delete s.special_block; // retire legacy after conversion
  renderExtrasEditorUI(s.extras);
  markDirty("Convert legacy block to extras");
  setStatus("Converted legacy block to editable Extras");
});

function renderExtrasEditorUI(arr){
  extrasEditor.innerHTML = "";
  (arr || []).forEach((sec, idx)=>{
    const card = document.createElement("div");
    card.className = "rounded border border-neutral-800 p-3";

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="text-sm font-semibold">Section ${idx+1}</div>
        <div class="flex items-center gap-2">
          <button data-move="up" class="btn text-xs">▲</button>
          <button data-move="down" class="btn text-xs">▼</button>
          <button data-del="1" class="btn-danger text-xs">Delete</button>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
        <div>
          <label class="text-xs">Title</label>
          <input class="input ex-title" value="${escapeAttr(sec.title||"")}" placeholder="Section title">
        </div>
        <div>
          <label class="text-xs">Style</label>
          <select class="input ex-style">
            <option value="cards-2col"${(sec.style||"cards-2col")==="cards-2col"?" selected":""}>Cards (2 columns)</option>
          </select>
        </div>
      </div>
      <div class="mt-2">
        <label class="text-xs">Description (optional)</label>
        <textarea rows="2" class="input ex-desc" placeholder="Short blurb">${escapeHTML(sec.description||"")}</textarea>
      </div>
      <div class="mt-2">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold">Items</label>
          <button data-additem="1" class="btn text-xs">Add item</button>
        </div>
        <div class="mt-2 space-y-2 ex-items"></div>
      </div>
    `;

    // render items
    const itemsWrap = card.querySelector(".ex-items");
    (sec.items||[]).forEach((it, j)=>{
      itemsWrap.appendChild(makeItemRow(it));
    });

    // handlers
    card.querySelector('[data-additem]').addEventListener('click', ()=>{
      itemsWrap.appendChild(makeItemRow({ title:"", subtitle:"", url:"" }));
      markDirty("Add extras item");
    });
    card.querySelector('[data-del]').addEventListener('click', ()=>{
      const all = getExtrasFromUI();
      all.splice(idx,1);
      renderExtrasEditorUI(all);
      markDirty("Delete extras section");
    });
    card.querySelector('[data-move="up"]').addEventListener('click', ()=>{
      const all = getExtrasFromUI();
      if (idx>0){ const t = all[idx-1]; all[idx-1] = all[idx]; all[idx] = t; }
      renderExtrasEditorUI(all);
      markDirty("Reorder extras section");
    });
    card.querySelector('[data-move="down"]').addEventListener('click', ()=>{
      const all = getExtrasFromUI();
      if (idx<all.length-1){ const t = all[idx+1]; all[idx+1] = all[idx]; all[idx] = t; }
      renderExtrasEditorUI(all);
      markDirty("Reorder extras section");
    });

    extrasEditor.appendChild(card);
  });
}

function makeItemRow(it){
  const row = document.createElement("div");
  row.className = "grid grid-cols-1 md:grid-cols-5 gap-2";
  row.innerHTML = `
    <input class="input ex-item-title md:col-span-2" placeholder="Item title" value="${escapeAttr(it.title||"")}">
    <input class="input ex-item-subtitle md:col-span-2" placeholder="Subtitle (optional)" value="${escapeAttr(it.subtitle||"")}">
    <div class="flex gap-2">
      <input class="input ex-item-url" placeholder="https://..." value="${escapeAttr(it.url||"")}">
      <button class="btn text-xs ex-item-del" title="Remove">✕</button>
    </div>
  `;
  row.querySelector('.ex-item-del').addEventListener('click', ()=>{
    row.remove();
    markDirty("Delete extras item");
  });
  return row;
}

function getExtrasFromUI(){
  const sections = [];
  [...extrasEditor.children].forEach(card=>{
    const title = sTrim(card.querySelector('.ex-title').value);
    const style = sTrim(card.querySelector('.ex-style').value) || "cards-2col";
    const description = sTrim(card.querySelector('.ex-desc').value);
    const items = [];
    [...card.querySelectorAll('.ex-items > div')].forEach(r=>{
      const t = sTrim(r.querySelector('.ex-item-title').value);
      const st = sTrim(r.querySelector('.ex-item-subtitle').value);
      const url = sTrim(r.querySelector('.ex-item-url').value);
      if (!t) return; // require title
      if (url && !/^https?:\/\//i.test(url)) return alert(`Invalid URL: ${url}`);
      items.push({ title: t, subtitle: st || undefined, url: url || undefined });
    });
    if (!title) return; // require section title
    sections.push({ title, style, description: description || undefined, items });
  });
  return sections;
}

// New / Save / Delete
newSolutionBtn.addEventListener("click", ()=>{
  window.selectedSolutionId = null;
  s_id.value = "";
  s_name.value = "";
  s_category.value = window.activeCategory || (DATA.categories?.[0] || "");
  s_summary.value = "";
  s_details.value = "";
  s_link_product.value = "";
  s_link_paper.value = "";
  renderTagPicker();
  renderExtrasEditorUI([]);
  setSolutionMode("new");
});

saveSolutionBtn.addEventListener("click", (e)=>{
  e.preventDefault();
  if (window.selectedSolutionId && !s_id.value) s_id.value = window.selectedSolutionId;
  try{
    const s = collectSolutionFromForm();
    const exists = (DATA.solutions||[]).find(x=>x.id===s.id);
    const verb = exists ? "Update" : "Add";
    if (exists) {
      if (!confirm(`Update this existing solution?\n\n${s.name}`)) return;
    }
    upsertSolution(s);
    renderSolutionsList();
    window.selectedSolutionId = s.id;
    setSolutionMode("edit", s.name);
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
  newSolutionBtn.click();
  renderSolutionsList();
  markDirty(`Delete solution`);
  setStatus("Solution deletion staged");
});

function collectSolutionFromForm(){
  let id = sTrim(s_id.value);
  const name = sTrim(s_name.value);
  const category = sTrim(s_category.value);
  if(!name || !category) throw new Error("Name and Category are required.");

  if (!id) {
    // derive id from name
    const base = slugify(name);
    if (!base) throw new Error("Could not derive an ID from the name.");
    id = base;
    let n = 2; const exists = (DATA.solutions||[]).some(x=>x.id===id);
    while ((DATA.solutions||[]).some(x=>x.id===id)) id = `${base}_${n++}`;
  } else {
    // editing existing -> allow same id
    const dup = (DATA.solutions||[]).find(x=>x.id===id && x.name !== name);
    if (dup && dup.id !== window.selectedSolutionId) throw new Error(`Solution ID "${id}" already exists. Try a different name.`);
  }

  const tags = [...tagPicker.querySelectorAll('input[type=checkbox]:checked')].map(cb=>cb.value);
  const details = s_details.value.split("\n").map(x=>x.trim()).filter(Boolean);
  const links = {
    product: sTrim(s_link_product.value) || undefined,
    paperwork: sTrim(s_link_paper.value) || undefined
  };

  // collect extras from UI
  const extras = getExtrasFromUI();
  return { id, name, category, tags, summary: s_summary.value, details, links, ...(extras.length?{extras}:{} ) };
}

function upsertSolution(s) {
  if(!Array.isArray(DATA.solutions)) DATA.solutions = [];
  const idx = DATA.solutions.findIndex(x=>x.id===s.id);
  if (idx >= 0) DATA.solutions[idx] = s;
  else DATA.solutions.push(s);
}

// ---------- Validation / Normalize / Diagnostics ----------
function validateData(obj, strict=false){
  if (typeof obj !== "object" || !obj) throw new Error("Root must be an object.");
  if (!Array.isArray(obj.categories)) throw new Error("categories must be an array.");
  if (typeof obj.features !== "object") throw new Error("features must be an object keyed by category.");
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

  // Solution skeleton
  obj.solutions.forEach(s=>{
    if (!s.id || !s.name || !s.category) throw new Error("Each solution needs id, name, category");
    if (!obj.categories.includes(s.category)) throw new Error(`Solution "${s.name}" has unknown category "${s.category}"`);
    if (s.extras) {
      if (!Array.isArray(s.extras)) throw new Error(`"extras" must be an array for ${s.name}`);
      s.extras.forEach((sec,i)=>{
        if (!sec.title) throw new Error(`extras[${i}] in "${s.name}" needs a title`);
        if (sec.items && !Array.isArray(sec.items)) throw new Error(`extras[${i}].items must be an array in "${s.name}"`);
      });
    }
  });
}

function normalizeDataForRuntime(data) {
  // same logic as app.js, but defined here for preview/save
  const clone = JSON.parse(JSON.stringify(data || {}));
  const byCat = {};
  (clone.categories || []).forEach(cat => {
    const feats = (clone.features && clone.features[cat]) || [];
    const id2label = {};
    const label2id = {};
    feats.forEach(f => { id2label[f.id] = f.label; label2id[f.label.toLowerCase()] = f.id; });
    byCat[cat] = { id2label, label2id };
  });
  (clone.solutions || []).forEach(sol => {
    const { id2label, label2id } = byCat[sol.category] || { id2label:{}, label2id:{} };
    const allowed = new Set(Object.keys(id2label));
    const before = Array.isArray(sol.tags) ? sol.tags : [];
    const after = [];
    for (const t of before) {
      if (allowed.has(t)) { after.push(t); continue; }
      const rescue = label2id[String(t).trim().toLowerCase()];
      if (rescue && allowed.has(rescue)) after.push(rescue);
    }
    sol.tags = after;
  });
  return clone;
}

function analyzeInvalidTags(data){
  const msgs = [];
  const byCat = {};
  (data.categories || []).forEach(cat=>{
    const feats = (data.features && data.features[cat]) || [];
    const id2label = {};
    const label2id = {};
    feats.forEach(f=>{ id2label[f.id]=f.label; label2id[f.label.toLowerCase()]=f.id; });
    byCat[cat] = { id2label, label2id };
  });
  (data.solutions || []).forEach(sol=>{
    const { id2label, label2id } = byCat[sol.category] || { id2label:{}, label2id:{} };
    const allowed = new Set(Object.keys(id2label));
    const removed = [];
    const rescued = [];
    (sol.tags||[]).forEach(t=>{
      if (allowed.has(t)) return;
      const r = label2id[String(t).trim().toLowerCase()];
      if (r && allowed.has(r)) rescued.push(`${t} -> ${r} (${id2label[r]})`);
      else removed.push(t);
    });
    if (rescued.length) msgs.push(`Auto-map needed for "${sol.name}" (${sol.category}): ${rescued.join(", ")}`);
    if (removed.length) msgs.push(`Would remove from "${sol.name}" (${sol.category}): ${removed.join(", ")}`);
  });
  return msgs;
}

// ---------- Utils ----------
function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
function sTrim(v){ return String(v||"").trim(); }
function slugify(s){
  return s.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}
function escapeHTML(s){ return (s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }
function escapeAttr(s){ return escapeHTML(s).replace(/"/g, "&quot;"); }

function downloadJSON(obj, filename="solutions.json"){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
