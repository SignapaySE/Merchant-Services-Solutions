// ======================================
// Main App Script (app.js)
// ======================================

// ---- Data loading (preview-aware + versioned live fetch) ----
async function loadSolutions() {
  const v = localStorage.getItem('app_version') || '';
  const urlParams = new URL(location.href).searchParams;

  // Preview is explicit and session-scoped:
  // Only if ?preview=1 AND preview exists in sessionStorage AND version matches
  const previewRequested = urlParams.get('preview') === '1';
  const pEnabled = sessionStorage.getItem('solutions_preview_enabled') === '1';
  const pVersion = sessionStorage.getItem('solutions_preview_version') || '';
  const pDataRaw = sessionStorage.getItem('solutions_preview_data');

  const canUsePreview = previewRequested && pEnabled && pDataRaw && pVersion === v;

  if (canUsePreview) {
    try {
      console.log('⚡ Using PREVIEW data from sessionStorage');
      return JSON.parse(pDataRaw);
    } catch {
      console.warn('Preview JSON was invalid. Falling back to live data.');
    }
  }

  // Live fetch (cache-busted). Use the original location next to index.html.
  const liveUrl = `./solutions.json${v ? `?v=${encodeURIComponent(v)}` : ''}`;
  const res = await fetch(liveUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load solutions.json');
  return res.json();
}

/* ===== State ===== */
let step = 1;
let bizType = null;
let selected = [];
let openSolution = null;
let DATA = null;

/* ===== DOM refs ===== */
const stepper = document.getElementById('stepper');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const needsTitle = document.getElementById('needsTitle');
const needsGrid = document.getElementById('needsGrid');
const solutionsGrid = document.getElementById('solutionsGrid');
const resetBtn = document.getElementById('resetBtn');
const adjustNeedsBtn = document.getElementById('adjustNeeds');
const promptEl = document.getElementById('categoryPrompt');
const promptTextEl = document.getElementById('promptText');
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
const specialBlocksSection = document.getElementById('specialBlocksSection');
const specialBlocksList = document.getElementById('specialBlocksList');

// --- icons (lucide-style) ---
const CATEGORY_ICONS = {
  Restaurant: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
      <path d="M4 3v6a3 3 0 0 0 6 0V3"></path>
      <path d="M10 9h10v12"></path>
      <path d="M15 9v12"></path>
    </svg>`,
  Retail: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
      <path d="M3 7h18l-2 10H5L3 7z"></path>
      <path d="M16 7a4 4 0 0 1-8 0"></path>
    </svg>`,
  Service: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
      <path d="M3 21l3-3"></path>
      <path d="M7 7l10 10"></path>
      <path d="M17 5l3 3"></path>
    </svg>`,
  Ecommerce: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6">
      <path d="M6 6h15l-2 9H8L6 6z"></path>
      <path d="M6 6l-2-2"></path>
      <circle cx="9" cy="19" r="1.5" fill="currentColor"></circle>
      <circle cx="17" cy="19" r="1.5" fill="currentColor"></circle>
    </svg>`
};

/* ===== Utils ===== */
function escapeHTML(s){
  return String(s ?? "").replace(/[&<>\"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
}

/* ===== Rendering ===== */
function renderPrompt() {
  if (!promptEl || !promptTextEl) return;

  let msg = '';
  if (step === 1) msg = 'What type of business are you working with today?';
  else if (step === 2) msg = `Select the needs/features for this ${bizType || 'business'}.`;
  else if (step === 3) msg = 'Here are your matches (highest score first). Tap a card to see details.';

  promptTextEl.textContent = msg;
}

function renderStepper() {
  if (!stepper) return;
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

function makeTypeButton(label) {
  const btn = document.createElement('button');
  btn.type = "button";
  btn.className = "button-3d group flex w-full items-center gap-4 p-5 text-left";
  btn.onclick = () => { bizType = label; step = 2; render(); };

  const iconWrap = document.createElement('span');
  iconWrap.className = "icon-glow relative inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/5 border border-white/10 text-cyan-300";
  const iconSvg = CATEGORY_ICONS[label] || "";
  iconWrap.innerHTML = `<span class="relative z-10">${iconSvg}</span>`;

  const left = document.createElement('div');
  left.className = "flex-1";
  left.innerHTML = `<div class="font-semibold text-slate-100 text-lg">${label}</div>`;

  const arrow = document.createElement('span');
  arrow.className = "ml-auto inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/15 bg-white/5 transition group-hover:translate-x-0.5";
  arrow.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="text-white/80">
    <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  btn.append(iconWrap, left, arrow);
  return btn;
}

function renderStep1() {
  if (!step1) return;
  step1.innerHTML = "";
  step1.classList.toggle('hidden', step !== 1);
  if (step !== 1) return;
  DATA.categories.forEach(t => step1.appendChild(makeTypeButton(t)));
}

function renderStep2() {
  if (!step2) return;
  step2.classList.toggle('hidden', step !== 2);
  if (step !== 2) return;

  needsTitle.textContent = `What does this ${bizType} need?`;
  needsGrid.innerHTML = "";

  const menu = (DATA.features[bizType] || []);
  menu.forEach(f => {
    const label = document.createElement('label');
    label.className = "flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 p-3 hover:bg-slate-700";

    const input = document.createElement('input');
    input.type = "checkbox";
    input.className = "h-4 w-4";
    input.checked = selected.includes(f.label);
    input.onchange = () => {
      if (selected.includes(f.label)) selected = selected.filter(x => x !== f.label);
      else selected.push(f.label);
    };

    const span = document.createElement('span');
    span.className = "text-sm text-slate-100";
    span.textContent = f.label;

    label.append(input, span);
    needsGrid.appendChild(label);
  });

  // Safely bind the control buttons if they exist
  const selAll = document.getElementById('selectAll');
  const clrAll = document.getElementById('clearAll');
  const back1  = document.getElementById('backTo1');
  const next3  = document.getElementById('toStep3');

  if (selAll) selAll.onclick = () => { selected = menu.map(m=>m.label); renderStep2(); };
  if (clrAll) clrAll.onclick = () => { selected = []; renderStep2(); };
  if (back1)  back1.onclick  = () => { step = 1; render(); };
  if (next3)  next3.onclick  = () => { step = 3; render(); };
}

function scoreSolution(item) {
  if (selected.length === 0) return 100;

  const featLabelsMap = (DATA.features[item.category] || [])
    .reduce((acc, f) => { acc[f.id] = f.label; return acc; }, {});

  const overlap = (item.tags || [])
    .map(tag => featLabelsMap[tag] || null)
    .filter(Boolean)
    .filter(label => selected.includes(label)).length;

  return Math.round((overlap / Math.max(selected.length, 1)) * 100);
}

function makeSolutionCard(item, score) {
  const btn = document.createElement('button');
  btn.type = "button";
  btn.className = "text-left w-full";
  btn.onclick = () => openAnalysis(item);

  const card = document.createElement('div');
  card.className = "surface-3d p-4 transition hover:shadow-[0_16px_34px_-12px_rgba(84,214,255,.36)]";

  const top = document.createElement('div');
  top.className = "mb-1 flex items-start justify-between gap-3";

  const title = document.createElement('h3');
  title.className = "text-base font-semibold text-slate-100";
  title.textContent = item.name;

  const badge = document.createElement('span');
  badge.className = "inline-flex items-center rounded-full border border-blue-400 bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-200";
  badge.textContent = item.category;

  top.append(title, badge);

  const desc = document.createElement('p');
  desc.className = "mb-3 text-sm text-slate-300";
  desc.textContent = item.summary;

  const ms = document.createElement('div');
  const scoreColor = score > 0 ? "text-green-400" : "text-red-400";
  ms.className = "mb-3 text-xs text-slate-300";
  ms.innerHTML = `Match score: <span class="font-semibold ${scoreColor}">${score}%</span>`;

  card.append(top, desc, ms);
  btn.appendChild(card);
  return btn;
}

function renderStep3() {
  if (!step3) return;
  step3.classList.toggle('hidden', step !== 3);
  if (step !== 3) return;

  solutionsGrid.innerHTML = "";
  const pool = DATA.solutions.filter(c => c.category === bizType);
  const scored = pool.map(item => ({ item, score: scoreSolution(item) }))
                     .sort((a,b) => b.score - a.score);

  if (scored.length === 0) {
    const empty = document.createElement('div');
    empty.className = "rounded-xl border border-slate-700 bg-slate-800 p-6 text-sm text-slate-300";
    empty.textContent = "No matches yet. Try adding or removing needs.";
    solutionsGrid.appendChild(empty);
  } else {
    scored.forEach(({item, score}) => solutionsGrid.appendChild(makeSolutionCard(item, score)));
  }
  if (adjustNeedsBtn) adjustNeedsBtn.onclick = () => { step = 2; render(); };
}

/* ===== Modal control ===== */
function openAnalysis(item) {
  openSolution = item;

  modalTitle.textContent = item.name;
  modalLinks.innerHTML = "";
  if (item.links && item.links.product) {
    const a = document.createElement('a');
    a.href = item.links.product; a.target = "_blank"; a.rel = "noreferrer";
    a.className = "rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700";
    a.textContent = "Official product page ↗";
    modalLinks.appendChild(a);
  }
  if (item.links && item.links.paperwork) {
    const a2 = document.createElement('a');
    a2.href = item.links.paperwork; a2.target = "_blank"; a2.rel = "noreferrer";
    a2.className = "rounded-lg bg-blue-900/30 px-3 py-2 text-xs font-medium text-blue-200 ring-1 ring-blue-800 hover:bg-blue-900/50";
    a2.textContent = "Paperwork ↗";
    modalLinks.appendChild(a2);
  }

  const featLabels = (DATA.features[item.category] || []).reduce((acc,f)=>{acc[f.id]=f.label;return acc;}, {});
  const matches = selected.filter(f => item.tags.map(t=>featLabels[t]).includes(f));
  const misses  = selected.filter(f => !item.tags.map(t=>featLabels[t]).includes(f));
  modalMatches.innerHTML = matches.length ? matches.map(f => `<li>${f}</li>`).join("") : "<li>No direct matches selected.</li>";
  modalMisses.innerHTML = selected.length ? misses.map(f => `<li>${f}</li>`).join("") : "<li>No needs selected.</li>";

  allFeatures.innerHTML = (item.tags || []).map(t =>
    `<span class="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-200">${escapeHTML(featLabels[t]||t)}</span>`
  ).join("");

  // Special Blocks (data-driven)
  if (Array.isArray(item.specialBlocks) && item.specialBlocks.length) {
    specialBlocksList.innerHTML = item.specialBlocks.map(b => `
      <li class="rounded-lg border border-slate-700 p-3 text-sm">
        <div class="font-medium">${escapeHTML(b.name)}</div>
        <div class="text-xs text-slate-400">${escapeHTML(b.description)}</div>
        ${b.link ? `<a href="${escapeHTML(b.link)}" target="_blank" rel="noreferrer" class="mt-2 inline-block text-xs font-medium text-blue-300 underline">View product ↗</a>` : ``}
      </li>
    `).join("");
    specialBlocksSection.classList.remove('hidden');
  } else {
    specialBlocksSection.classList.add('hidden');
    specialBlocksList.innerHTML = "";
  }

  // Hide legacy hardcoded blocks (now superseded)
  terminalDetails.classList.add('hidden');
  shift4Details.classList.add('hidden');

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

/* ===== Wire events ===== */
if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
if (modalClose)    modalClose.addEventListener('click', closeModal);
if (resetBtn)      resetBtn.addEventListener('click', () => { step = 1; bizType = null; selected = []; render(); });

/* ===== Init ===== */
async function bootstrap() {
  DATA = await loadSolutions();
  render();
}
function render(){ renderStepper(); renderStep1(); renderStep2(); renderStep3(); renderPrompt(); }
bootstrap();
