// app.js — loads data/solutions.json and renders your original UI/flow (vanilla JS)

const DATA_URL = "data/solutions.json"; // relative path for GitHub Pages project sites

let DATA = null;

// ===== State =====
let step = 1;
let bizType = null;
let selected = [];
let openSolution = null;

// ===== DOM refs =====
const stepper = document.getElementById('stepper');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const needsTitle = document.getElementById('needsTitle');
const needsGrid = document.getElementById('needsGrid');
const solutionsGrid = document.getElementById('solutionsGrid');
const resetBtn = document.getElementById('resetBtn');
const adjustNeedsBtn = document.getElementById('adjustNeeds');

const modal = document.getElementById('modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalLinks = document.getElementById('modalLinks');
const modalMatches = document.getElementById('modalMatches');
const modalMisses = document.getElementById('modalMisses');
const allFeatures = document.getElementById('allFeatures');
const terminalDetails = document.getElementById('terminalDetails');
const shift4Details = document.getElementById('shift4Details');

// ===== Init =====
init();
async function init() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    DATA = await res.json();
  } catch (err) {
    console.error("Failed to load data/solutions.json", err);
    alert("Could not load data/solutions.json. Check the file path and commit.");
    return;
  }
  render();
}

// ===== Rendering (exactly your original styles) =====
function render() { renderStepper(); renderStep1(); renderStep2(); renderStep3(); }

function renderStepper() {
  [...stepper.children].forEach((el, i) => {
    const idx = i + 1;
    const active = step === idx;
    const done = step > idx;
    el.className =
      "rounded-xl border px-3 py-2 " +
      (active
        ? "border-blue-400 bg-blue-900 text-blue-100"
        : done
        ? "border-blue-300 bg-slate-800 text-blue-300"
        : "border-slate-700 bg-slate-800 text-slate-400");
  });
}

function renderStep1() {
  step1.innerHTML = "";
  step1.classList.toggle('hidden', step !== 1);
  const cats = DATA.categories || [];
  const iconMap = { Restaurant: "🍽️", Retail: "🛍️" };
  cats.forEach(label => {
    const btn = document.createElement('button');
    btn.type = "button";
    btn.className =
      "group flex w-full items-center gap-3 rounded-2xl border p-4 transition border-slate-700 bg-slate-800 hover:bg-slate-700";
    btn.onclick = () => { bizType = label; step = 2; render(); };

    const iconDiv = document.createElement('div');
    iconDiv.className = "text-lg";
    iconDiv.textContent = iconMap[label] || "💼";

    const left = document.createElement('div');
    left.className = "flex-1 text-left";
    left.innerHTML = `
      <div class="font-semibold text-slate-100">${label}</div>
      <div class="text-xs text-slate-400">Tap to select this business type</div>
    `;

    const bullet = document.createElement('div');
    bullet.className = "h-5 w-5 rounded-full border border-slate-600";

    btn.append(iconDiv, left, bullet);
    step1.appendChild(btn);
  });
}

function renderStep2() {
  step2.classList.toggle('hidden', step !== 2);
  if (step !== 2) return;

  needsTitle.textContent = `What does this ${bizType} need?`;
  needsGrid.innerHTML = "";

  const menu = (DATA.features && DATA.features[bizType]) ? DATA.features[bizType] : [];
  menu.forEach(f => {
    const label = document.createElement('label');
    label.className = "flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 p-3 hover:bg-slate-700";

    const input = document.createElement('input');
    input.type = "checkbox";
    input.className = "h-4 w-4";
    input.checked = selected.includes(f.id);
    input.onchange = () => {
      if (selected.includes(f.id)) selected = selected.filter(x => x !== f.id);
      else selected.push(f.id);
    };

    const span = document.createElement('span');
    span.className = "text-sm text-slate-100";
    span.textContent = f.label;

    label.append(input, span);
    needsGrid.appendChild(label);
  });

  document.getElementById('selectAll').onclick = () => { selected = menu.map(f => f.id); renderStep2(); };
  document.getElementById('clearAll').onclick = () => { selected = []; renderStep2(); };
  document.getElementById('backTo1').onclick = () => { step = 1; render(); };
  document.getElementById('toStep3').onclick  = () => { step = 3; render(); };
}

function scoreSolution(sol) {
  if (selected.length === 0) return 100;
  const tags = new Set(sol.tags || []);
  const overlap = selected.filter(t => tags.has(t)).length;
  return Math.round((overlap / Math.max(selected.length, 1)) * 100);
}

function makeSolutionCard(sol, score) {
  const btn = document.createElement('button');
  btn.type = "button";
  btn.className = "text-left w-full";
  btn.onclick = () => openAnalysis(sol);

  const card = document.createElement('div');
  card.className = "rounded-2xl border border-blue-500/40 bg-slate-800 p-4 shadow-sm transition hover:shadow-md";

  const top = document.createElement('div');
  top.className = "mb-1 flex items-start justify-between gap-3";

  const title = document.createElement('h3');
  title.className = "text-base font-semibold text-slate-100";
  title.textContent = sol.name;

  const badge = document.createElement('span');
  badge.className = "inline-flex items-center rounded-full border border-blue-400 bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-200";
  badge.textContent = sol.category;

  top.append(title, badge);

  const desc = document.createElement('p');
  desc.className = "mb-3 text-sm text-slate-300";
  desc.textContent = sol.summary || "";

  const ms = document.createElement('div');
  const scoreColor = score > 0 ? "text-green-400" : "text-red-400";
  ms.className = "mb-3 text-xs text-slate-300";
  ms.innerHTML = `Match score: <span class="font-semibold ${scoreColor}">${score}%</span>`;

  card.append(top, desc, ms);
  btn.appendChild(card);
  return btn;
}

function renderStep3() {
  step3.classList.toggle('hidden', step !== 3);
  if (step !== 3) return;

  solutionsGrid.innerHTML = "";
  const pool = (DATA.solutions || []).filter(s => s.category === bizType);
  const scored = pool.map(s => ({ s, score: scoreSolution(s) })).sort((a,b) => b.score - a.score);

  if (!scored.length) {
    const empty = document.createElement('div');
    empty.className = "rounded-xl border border-slate-700 bg-slate-800 p-6 text-sm text-slate-300";
    empty.textContent = "No matches yet. Try adding or removing needs.";
    solutionsGrid.appendChild(empty);
  } else {
    scored.forEach(({s, score}) => solutionsGrid.appendChild(makeSolutionCard(s, score)));
  }

  adjustNeedsBtn.onclick = () => { step = 2; render(); };
}

// ===== Modal control =====
function openAnalysis(sol) {
  openSolution = sol;

  modalTitle.textContent = sol.name;
  modalLinks.innerHTML = "";
  if (sol.links?.product) {
    const a = document.createElement('a');
    a.href = sol.links.product; a.target = "_blank"; a.rel = "noreferrer";
    a.className = "rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700";
    a.textContent = "Official product page ↗";
    modalLinks.appendChild(a);
  }
  if (sol.links?.paperwork) {
    const a2 = document.createElement('a');
    a2.href = sol.links.paperwork; a2.target = "_blank"; a2.rel = "noreferrer";
    a2.className = "rounded-lg bg-blue-900/30 px-3 py-2 text-xs font-medium text-blue-200 ring-1 ring-blue-800 hover:bg-blue-900/50";
    a2.textContent = "Paperwork ↗";
    modalLinks.appendChild(a2);
  }

  const tags = new Set(sol.tags || []);
  const matches = selected.filter(f => tags.has(f)).map(id => labelFor(id));
  const misses  = selected.filter(f => !tags.has(f)).map(id => labelFor(id));

  modalMatches.innerHTML = matches.length ? matches.map(f => `<li>${escapeHTML(f)}</li>`).join("") : "<li>No direct matches selected.</li>";
  modalMisses.innerHTML  = selected.length ? misses.map(f => `<li>${escapeHTML(f)}</li>`).join("") : "<li>No needs selected.</li>";

  // Show all features (labels) that solution supports
  const allLabels = (sol.tags || []).map(id => labelFor(id));
  allFeatures.innerHTML = allLabels.map(f =>
    `<span class="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-200">${escapeHTML(f)}</span>`
  ).join("");

  // Special blocks
  terminalDetails.classList.add('hidden');
  shift4Details.classList.add('hidden');
  if (sol.special_block === "terminalDetails") terminalDetails.classList.remove('hidden');
  if (sol.special_block === "shift4Details")   shift4Details.classList.remove('hidden');

  modal.classList.remove('hidden'); modal.classList.add('flex');
  document.documentElement.classList.add('scroll-lock');
  document.body.classList.add('scroll-lock');
}

function closeModal() {
  modal.classList.add('hidden'); modal.classList.remove('flex');
  openSolution = null;
  document.documentElement.classList.remove('scroll-lock');
  document.body.classList.remove('scroll-lock');
}

function labelFor(id){
  // find the label by id across all categories
  const feats = DATA.features || {};
  for (const cat of Object.keys(feats)) {
    const f = feats[cat].find(x => x.id === id);
    if (f) return f.label;
  }
  return id;
}
function escapeHTML(s){ return String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }

// ===== Events =====
modalBackdrop.addEventListener('click', closeModal);
modalClose.addEventListener('click', closeModal);
resetBtn.addEventListener('click', () => { step = 1; bizType = null; selected = []; render(); });
