/* Merchant Solutions Finder (Data-Driven)
   - Loads /data/solutions.json
   - Step 1: choose category
   - Step 2: choose needs (feature checkboxes)
   - Step 3: scored solutions, modal with matches/misses
   - Keeps special blocks for terminal details
*/

const DATA_URL = "data/solutions.json";

let DATA = null;
let state = {
  category: null,
  selected: new Set(),
};

// DOM
const stepper = document.getElementById("stepper");
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const categoryWrap = document.getElementById("categoryWrap");
const featuresWrap = document.getElementById("featuresWrap");
const resultsWrap = document.getElementById("resultsWrap");
const selectionSummary = document.getElementById("selectionSummary");

const toStep2Btn = document.getElementById("toStep2");
const toStep3Btn = document.getElementById("toStep3");
const backTo1Btn = document.getElementById("backTo1");
const backTo2Btn = document.getElementById("backTo2");
const resetBtn = document.getElementById("resetBtn");

// Modal
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalProductLink = document.getElementById("modalProductLink");
const modalPaperLink = document.getElementById("modalPaperLink");
const modalClose = document.getElementById("modalClose");

init();

async function init() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    DATA = await res.json();
  } catch (e) {
    console.error("Failed to load data:", e);
    alert("Could not load /data/solutions.json");
    return;
  }

  renderStep1();
  wireUI();
}

function wireUI() {
  toStep2Btn.addEventListener("click", () => gotoStep(2));
  backTo1Btn.addEventListener("click", () => gotoStep(1));
  toStep3Btn.addEventListener("click", () => {
    renderResults();
    gotoStep(3);
  });
  backTo2Btn.addEventListener("click", () => gotoStep(2));
  resetBtn.addEventListener("click", () => resetFlow());

  // Modal close
  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target.dataset.close === "true") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function gotoStep(n) {
  // Update stepper highlight
  [...stepper.querySelectorAll("[data-step]")].forEach((el) => {
    const step = Number(el.dataset.step);
    if (step === n) {
      el.className = "px-3 py-1 rounded-full bg-emerald-600/20 border border-emerald-600/30";
    } else {
      el.className = "px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700";
    }
  });

  step1.classList.add("hidden");
  step2.classList.add("hidden");
  step3.classList.add("hidden");
  if (n === 1) step1.classList.remove("hidden");
  if (n === 2) step2.classList.remove("hidden");
  if (n === 3) step3.classList.remove("hidden");
}

function resetFlow() {
  state = { category: null, selected: new Set() };
  toStep2Btn.disabled = true;
  renderStep1();
  gotoStep(1);
}

function renderStep1() {
  categoryWrap.innerHTML = "";
  const cats = DATA.categories || [];
  cats.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "card w-full px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-left";
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      state.category = cat;
      toStep2Btn.disabled = false;
      [...categoryWrap.children].forEach((c) => c.classList.remove("ring-2","ring-emerald-500"));
      btn.classList.add("ring-2","ring-emerald-500");
      // preload Step 2
      renderStep2();
    });
    categoryWrap.appendChild(btn);
  });
}

function renderStep2() {
  featuresWrap.innerHTML = "";
  state.selected = new Set(); // reset when changing categories
  const list = (DATA.features && DATA.features[state.category]) || [];
  list.forEach((feat) => {
    const id = `feat_${feat.id}`;
    const label = document.createElement("label");
    label.className = "flex items-center gap-3 p-2 rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-700";
    label.innerHTML = `
      <input id="${id}" type="checkbox" class="h-4 w-4 rounded border-neutral-600 bg-neutral-900">
      <span>${escapeHTML(feat.label)}</span>
    `;
    label.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) state.selected.add(feat.id);
      else state.selected.delete(feat.id);
    });
    featuresWrap.appendChild(label);
  });
}

function renderResults() {
  resultsWrap.innerHTML = "";
  const selected = Array.from(state.selected);
  selectionSummary.textContent =
    `${state.category} • ${selected.length} need${selected.length===1?"":"s"} selected`;

  const solutions = (DATA.solutions || []).filter(s => s.category === state.category);

  const scored = solutions.map((s) => {
    const tags = new Set(s.tags || []);
    let matches = 0;
    selected.forEach((id) => { if (tags.has(id)) matches++; });
    const score = selected.length ? Math.round((matches / selected.length) * 100) : 0;
    const misses = selected.filter((id) => !tags.has(id));
    const matched = selected.filter((id) => tags.has(id));
    return { solution: s, score, matches: matched, misses };
  }).sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    resultsWrap.innerHTML = `<div class="text-neutral-300">No solutions for ${escapeHTML(state.category)} yet.</div>`;
    return;
  }

  scored.forEach(({ solution, score, matches, misses }) => {
    const card = document.createElement("button");
    card.className = "card text-left w-full p-4 rounded-xl bg-neutral-800 border border-neutral-700 hover:bg-neutral-700";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-base font-semibold">${escapeHTML(solution.name)}</div>
          <div class="text-neutral-300 text-sm">${escapeHTML(solution.summary || "")}</div>
          <div class="mt-2 flex flex-wrap gap-1">
            ${matches.slice(0,6).map(id => `<span class="chip px-2 py-0.5 rounded-full text-xs bg-neutral-900">${escapeHTML(labelFor(id))}</span>`).join("")}
          </div>
        </div>
        <div class="shrink-0 text-right">
          <div class="text-2xl font-bold">${score}%</div>
          <div class="text-xs text-neutral-400">match</div>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openModal({solution, score, matches, misses}));
    resultsWrap.appendChild(card);
  });
}

function openModal({solution, score, matches, misses}) {
  modalTitle.textContent = solution.name;
  modalProductLink.href = (solution.links && solution.links.product) || "#";
  modalPaperLink.href = (solution.links && solution.links.paperwork) || "#";

  const blocks = [];

  // Score / summary
  blocks.push(`
    <div class="flex items-center justify-between">
      <div>
        <div class="text-sm text-neutral-300">${escapeHTML(solution.summary || "")}</div>
        ${Array.isArray(solution.details) && solution.details.length ? `
          <ul class="mt-2 list-disc list-inside text-neutral-200">
            ${solution.details.map(d => `<li>${escapeHTML(d)}</li>`).join("")}
          </ul>
        ` : ""}
      </div>
      <div class="text-right">
        <div class="text-3xl font-bold">${score}%</div>
        <div class="text-xs text-neutral-400">overall match</div>
      </div>
    </div>
  `);

  // Matches / Misses
  blocks.push(`
    <div class="grid sm:grid-cols-2 gap-3">
      <div class="p-3 rounded-lg bg-neutral-800 border border-neutral-700">
        <div class="font-semibold mb-1">Matches</div>
        <div class="flex flex-wrap gap-1">
          ${matches.length ? matches.map(id => `<span class="chip px-2 py-0.5 rounded-full text-xs bg-emerald-900/30 border border-emerald-700/40">${escapeHTML(labelFor(id))}</span>`).join("") : '<span class="text-neutral-400 text-sm">None selected</span>'}
        </div>
      </div>
      <div class="p-3 rounded-lg bg-neutral-800 border border-neutral-700">
        <div class="font-semibold mb-1">Misses</div>
        <div class="flex flex-wrap gap-1">
          ${misses.length ? misses.map(id => `<span class="chip px-2 py-0.5 rounded-full text-xs bg-neutral-900">${escapeHTML(labelFor(id))}</span>`).join("") : '<span class="text-neutral-400 text-sm">No gaps</span>'}
        </div>
      </div>
    </div>
  `);

  // Special blocks
  if (solution.special_block === "terminalDetails") {
    blocks.push(renderTerminalDetailsBlock());
  }
  if (solution.special_block === "shift4Details") {
    blocks.push(renderShift4DetailsBlock());
  }

  modalBody.innerHTML = blocks.join("\n");
  modal.classList.remove("hidden");
  document.documentElement.classList.add("modal-open");
}

function closeModal() {
  modal.classList.add("hidden");
  document.documentElement.classList.remove("modal-open");
}

function labelFor(id) {
  // Resolve id -> label using feature lists
  const lists = DATA.features || {};
  for (const cat of Object.keys(lists)) {
    const found = lists[cat].find(f => f.id === id);
    if (found) return found.label;
  }
  // fall back to id
  return id;
}

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

/* ----- Special Blocks ----- */

function renderTerminalDetailsBlock() {
  return `
    <div class="p-3 rounded-lg bg-neutral-800 border border-neutral-700">
      <div class="font-semibold mb-1">Terminal Details</div>
      <ul class="list-disc list-inside text-neutral-200 space-y-1">
        <li>Valor 100 — countertop EMV/NFC</li>
        <li>Dejavoo QD4 — wireless/wifi capable</li>
        <li>PAX A80 — compact countertop</li>
        <li>Dejavoo P3 — portable</li>
      </ul>
    </div>
  `;
}

function renderShift4DetailsBlock() {
  return `
    <div class="p-3 rounded-lg bg-neutral-800 border border-neutral-700">
      <div class="font-semibold mb-1">Shift4 Terminal Notes</div>
      <ul class="list-disc list-inside text-neutral-200 space-y-1">
        <li>EMV + Contactless across supported models</li>
        <li>PCI scope reduction features</li>
        <li>Receipt printing options</li>
      </ul>
    </div>
  `;
}
