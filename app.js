// ========= Storage Keys =========
const KEY = {
  income: "lilikoko_income_v1",
  cost: "lilikoko_cost_v1",
  goal: "lilikoko_goal_v1"
};

// ========= Helpers =========
const fmtMoney = (n) => (Number(n) || 0).toLocaleString("zh-Hant-TW");
const pad2 = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const monthISO = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function saveJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function yyyymmFromDate(dateStr) {
  // "2026-02-24" -> "2026-02"
  if (!dateStr || dateStr.length < 7) return "";
  return dateStr.slice(0, 7);
}

function typeLabelIncome(t){
  return t === "market" ? "市集" : t === "online" ? "網路" : "其他";
}
function typeLabelCost(t){
  return t === "material" ? "材料"
    : t === "packaging" ? "包裝"
    : t === "booth" ? "攤位費"
    : t === "shipping" ? "運費"
    : "其他";
}

// ========= State =========
let income = loadJSON(KEY.income, []);
let cost = loadJSON(KEY.cost, []);
let goals = loadJSON(KEY.goal, {}); // { "2026-02": 30000 }

let selectedMonth = monthISO(new Date());

// ========= DOM =========
const monthPicker = document.getElementById("monthPicker");
const goalInput = document.getElementById("goalInput");
const btnSaveGoal = document.getElementById("btnSaveGoal");

const kpiIncome = document.getElementById("kpiIncome");
const kpiCost = document.getElementById("kpiCost");
const kpiProfit = document.getElementById("kpiProfit");
const kpiProgress = document.getElementById("kpiProgress");
const kpiGoalText = document.getElementById("kpiGoalText");

const incomeForm = document.getElementById("incomeForm");
const costForm = document.getElementById("costForm");
const incomeTableBody = document.querySelector("#incomeTable tbody");
const costTableBody = document.querySelector("#costTable tbody");

const btnExport = document.getElementById("btnExport");
const fileImport = document.getElementById("fileImport");
const btnReset = document.getElementById("btnReset");

// ========= Charts =========
let lineChart = null;
let pieChart = null;

function buildCharts() {
  const lineCtx = document.getElementById("lineChart");
  const pieCtx = document.getElementById("pieChart");

  // Destroy old charts
  if (lineChart) lineChart.destroy();
  if (pieChart) pieChart.destroy();

  const months = lastNMonths(selectedMonth, 6);
  const lineData = months.map(m => monthlySummary(m));

  lineChart = new Chart(lineCtx, {
    type: "line",
    data: {
      labels: months,
      datasets: [
        { label: "收入", data: lineData.map(x => x.income) },
        { label: "成本", data: lineData.map(x => x.cost) },
        { label: "淨利", data: lineData.map(x => x.profit) }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#e7e9ee" } }
      },
      scales: {
        x: { ticks: { color: "#9aa0a6" }, grid: { color: "rgba(35,37,52,0.7)" } },
        y: { ticks: { color: "#9aa0a6" }, grid: { color: "rgba(35,37,52,0.7)" } }
      }
    }
  });

  const thisMonth = monthlySummary(selectedMonth);
  pieChart = new Chart(pieCtx, {
    type: "doughnut",
    data: {
      labels: ["市集", "網路", "其他"],
      datasets: [{
        data: [thisMonth.byIncomeType.market, thisMonth.byIncomeType.online, thisMonth.byIncomeType.other]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#e7e9ee" } }
      }
    }
  });
}

function lastNMonths(fromYYYYMM, n) {
  // returns ascending list length n, ending at fromYYYYMM
  const [yy, mm] = fromYYYYMM.split("-").map(Number);
  let d = new Date(yy, mm - 1, 1);
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
    arr.push(`${dd.getFullYear()}-${pad2(dd.getMonth() + 1)}`);
  }
  return arr;
}

function monthlySummary(yyyyMm) {
  const inc = income.filter(x => yyyymmFromDate(x.date) === yyyyMm);
  const cos = cost.filter(x => yyyymmFromDate(x.date) === yyyyMm);

  const sumInc = inc.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const sumCos = cos.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const byIncomeType = {
    market: inc.filter(x => x.type === "market").reduce((a,b)=>a+(Number(b.amount)||0),0),
    online: inc.filter(x => x.type === "online").reduce((a,b)=>a+(Number(b.amount)||0),0),
    other:  inc.filter(x => x.type === "other").reduce((a,b)=>a+(Number(b.amount)||0),0),
  };

  return {
    income: sumInc,
    cost: sumCos,
    profit: sumInc - sumCos,
    byIncomeType
  };
}

// ========= Render =========
function render() {
  // Goal
  const goal = Number(goals[selectedMonth] || 0);
  goalInput.value = goal ? String(goal) : "";

  // KPIs
  const s = monthlySummary(selectedMonth);
  kpiIncome.textContent = fmtMoney(s.income);
  kpiCost.textContent = fmtMoney(s.cost);
  kpiProfit.textContent = fmtMoney(s.profit);

  const progress = goal > 0 ? Math.min(999, Math.round((s.income / goal) * 100)) : 0;
  kpiProgress.textContent = goal > 0 ? `${progress}%` : "0%";
  kpiGoalText.textContent = `目標：${fmtMoney(goal)}`;

  // Tables
  renderIncomeTable();
  renderCostTable();

  // Charts
  buildCharts();
}

function renderIncomeTable() {
  const rows = income
    .filter(x => yyyymmFromDate(x.date) === selectedMonth)
    .sort((a,b)=> (a.date > b.date ? -1 : 1));

  incomeTableBody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${typeLabelIncome(r.type)}</td>
      <td class="right">${fmtMoney(r.amount)}</td>
      <td>${escapeHtml(r.note || "")}</td>
      <td class="right">
        <button class="icon-btn" data-action="del-income" data-id="${r.id}">刪除</button>
      </td>
    `;
    incomeTableBody.appendChild(tr);
  });
}

function renderCostTable() {
  const rows = cost
    .filter(x => yyyymmFromDate(x.date) === selectedMonth)
    .sort((a,b)=> (a.date > b.date ? -1 : 1));

  costTableBody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${typeLabelCost(r.type)}</td>
      <td class="right">${fmtMoney(r.amount)}</td>
      <td>${escapeHtml(r.note || "")}</td>
      <td class="right">
        <button class="icon-btn" data-action="del-cost" data-id="${r.id}">刪除</button>
      </td>
    `;
    costTableBody.appendChild(tr);
  });
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ========= Events =========
function init() {
  monthPicker.value = selectedMonth;

  // Default date for forms
  incomeForm.elements["date"].value = todayISO();
  costForm.elements["date"].value = todayISO();

  monthPicker.addEventListener("change", () => {
    selectedMonth = monthPicker.value || monthISO(new Date());
    render();
  });

  btnSaveGoal.addEventListener("click", () => {
    const goal = Number(goalInput.value || 0);
    goals[selectedMonth] = Math.max(0, Math.floor(goal));
    saveJSON(KEY.goal, goals);
    render();
  });

  incomeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = formToObj(incomeForm);
    const item = {
      id: cryptoId(),
      date: data.date,
      amount: Number(data.amount || 0),
      type: data.type,
      note: data.note || ""
    };
    income.push(item);
    saveJSON(KEY.income, income);
    incomeForm.reset();
    incomeForm.elements["date"].value = todayISO();
    render();
  });

  costForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = formToObj(costForm);
    const item = {
      id: cryptoId(),
      date: data.date,
      amount: Number(data.amount || 0),
      type: data.type,
      note: data.note || ""
    };
    cost.push(item);
    saveJSON(KEY.cost, cost);
    costForm.reset();
    costForm.elements["date"].value = todayISO();
    render();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "del-income") {
      income = income.filter(x => x.id !== id);
      saveJSON(KEY.income, income);
      render();
    }
    if (action === "del-cost") {
      cost = cost.filter(x => x.id !== id);
      saveJSON(KEY.cost, cost);
      render();
    }
  });

  btnExport.addEventListener("click", () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      income,
      cost,
      goals
    };
    downloadJson(payload, `lilikoko-data-${new Date().toISOString().slice(0,10)}.json`);
  });

  fileImport.addEventListener("change", async () => {
    const f = fileImport.files?.[0];
    if (!f) return;
    const text = await f.text();
    try {
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== "object") throw new Error("invalid");
      if (!Array.isArray(obj.income) || !Array.isArray(obj.cost) || typeof obj.goals !== "object") {
        throw new Error("格式不對");
      }
      income = obj.income;
      cost = obj.cost;
      goals = obj.goals;

      saveJSON(KEY.income, income);
      saveJSON(KEY.cost, cost);
      saveJSON(KEY.goal, goals);

      fileImport.value = "";
      render();
      alert("匯入成功！");
    } catch (err) {
      fileImport.value = "";
      alert("匯入失敗：JSON 格式不正確");
    }
  });

  btnReset.addEventListener("click", () => {
    const ok = confirm("確定要清空所有資料嗎？（建議先匯出備份）");
    if (!ok) return;
    income = [];
    cost = [];
    goals = {};
    saveJSON(KEY.income, income);
    saveJSON(KEY.cost, cost);
    saveJSON(KEY.goal, goals);
    render();
  });

  render();
}

function formToObj(form) {
  const fd = new FormData(form);
  return Object.fromEntries(fd.entries());
}

function cryptoId() {
  // Avoid external libs, stable-enough unique id
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

init();