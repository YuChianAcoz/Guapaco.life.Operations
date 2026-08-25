"use strict";
const STORAGE = {
  vehicles: "deliveryV3.vehicles",
  records: "deliveryV3.records",
};
const defaults = [
  ["KLM-0817", 16200],
  ["KEJ-6876", 15100],
  ["KLR-6699", 17010],
  ["KEJ-3179", 16400],
  ["KLK-6513", 16000],
  ["KLJ-3031", 16600],
].map(([vehicleNo, tareWeight]) => ({ vehicleNo, tareWeight, enabled: true }));
const state = {
  vehicles: load(STORAGE.vehicles, defaults),
  records: load(STORAGE.records, []),
};
const el = (id) => document.getElementById(id);
function localDateText(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const today = localDateText();
function load(k, f) {
  try {
    return JSON.parse(localStorage.getItem(k)) || structuredClone(f);
  } catch {
    return structuredClone(f);
  }
}
function save() {
  localStorage.setItem(STORAGE.vehicles, JSON.stringify(state.vehicles));
  localStorage.setItem(STORAGE.records, JSON.stringify(state.records));
}
function num(v) {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function fi(v) {
  return Number(v || 0).toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}
function ft(v) {
  return Number(v || 0).toLocaleString("zh-TW", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}
function esc(v = "") {
  return String(v).replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
}
function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + "-" + Math.random();
}
function toast(m) {
  const b = el("toast");
  b.textContent = m;
  b.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (b.hidden = true), 2400);
}
function minutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function timeText(total) {
  total = ((total % 1440) + 1440) % 1440;
  return (
    String(Math.floor(total / 60)).padStart(2, "0") +
    ":" +
    String(total % 60).padStart(2, "0")
  );
}
function addDays(date, days) {
  const [y, m, d] = String(date).split("-").map(Number);
  const local = new Date(y, m - 1, d);
  local.setDate(local.getDate() + days);
  return localDateText(local);
}
function renderVehicleSelect() {
  const opts = state.vehicles
    .map(
      (v) => `<option value="${esc(v.vehicleNo)}">${esc(v.vehicleNo)}</option>`,
    )
    .join("");
  el("singleVehicleNo").innerHTML = opts || '<option value="">無車輛</option>';
}
function renderVehicles() {
  const q = el("vehicleSearch").value.trim().toUpperCase();
  const rows = state.vehicles
    .map((v, i) => ({ ...v, i }))
    .filter((v) => !q || v.vehicleNo.includes(q));
  el("vehicleCount").textContent =
    `${state.vehicles.length} 輛／${state.vehicles.filter((v) => v.enabled).length} 輛啟用`;
  el("vehicleTbody").innerHTML = rows.length
    ? rows
        .map(
          (v) =>
            `<tr><td><input class="checkbox" type="checkbox" data-action="toggle" data-index="${v.i}" ${v.enabled ? "checked" : ""}></td><td><strong>${esc(v.vehicleNo)}</strong></td><td class="num">${fi(v.tareWeight)}</td><td><button class="action-link" data-action="edit" data-index="${v.i}">編輯</button><button class="action-link danger" data-action="delete" data-index="${v.i}">刪除</button></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="4" class="empty-cell">沒有車輛資料</td></tr>';
  renderVehicleSelect();
  updateEstimate();
}
function settings() {
  return {
    date: el("date").value,
    customer: el("customer").value.trim(),
    location: el("location").value.trim(),
    dispatcher: el("dispatcher").value.trim(),
    consignment: el("consignment").value.trim(),
    qualityControl: el("qualityControl").value.trim(),
    supervisor: el("supervisor").value.trim(),
    temperature: el("temperature").value.trim(),
    vehicleMode: el("vehicleMode").value,
    singleVehicleNo: el("singleVehicleNo").value,
    driver: el("driver").value.trim(),
    startTime: el("startTime").value,
    intervalMin: num(el("intervalMin").value),
    intervalMax: num(el("intervalMax").value),
    deliveryNoStart: el("deliveryNoStart").value.trim(),
    documentType: el("documentType").value,
    oilLarge: el("oilLarge").value.trim(),
    oilSmall: el("oilSmall").value.trim(),
    productName: el("productName").value.trim(),
    targetTons: num(el("targetTons").value),
    tareHint: num(el("tareHint").value),
    netMin: num(el("netMin").value),
    netMax: num(el("netMax").value),
    note: el("note").value.trim(),
  };
}
function selectedVehicles(s) {
  if (s.vehicleMode === "single")
    return state.vehicles.filter((v) => v.vehicleNo === s.singleVehicleNo);
  return state.vehicles.filter((v) => v.enabled);
}
function validateSettings(s) {
  if (
    !s.date ||
    !s.customer ||
    !s.location ||
    !s.deliveryNoStart ||
    !s.startTime
  )
    return "請填寫所有必填設定。";
  if (s.netMin <= 0 || s.netMax < s.netMin) return "淨重區間不正確。";
  if (s.targetTons <= 0 || s.intervalMin <= 0 || s.intervalMax <= 0)
    return "目標累計淨重與間隔時間必須大於 0。";
  if (s.intervalMax < s.intervalMin)
    return "出廠間隔區間不正確，最大間隔不可小於最小間隔。";
  if (!selectedVehicles(s).length) return "請至少選擇一輛車。";
  return "";
}
function updateEstimate() {
  const s = settings();
  const count = selectedVehicles(s).length;
  const msg =
    count && count * s.intervalMax < 120
      ? `目前 ${count} 輛車 × 最大間隔 ${s.intervalMax} 分鐘＝${count * s.intervalMax} 分鐘，仍可能小於同車 120 分鐘限制；試算時系統會自動延後衝突車次。`
      : "";
  showMessage(msg);
}
function showMessage(m) {
  el("validationMessage").textContent = m;
  el("validationMessage").hidden = !m;
}
function randomWeight(min, max) {
  return Math.round(min + Math.random() * (max - min));
}
function randomInteger(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return low + Math.floor(Math.random() * (high - low + 1));
}
function nextDeliveryNo(base, index) {
  const m = base.match(/^(.*?)(\d+)$/);
  if (!m) return `${base}-${String(index + 1).padStart(3, "0")}`;
  return m[1] + String(Number(m[2]) + index).padStart(m[2].length, "0");
}
function ceilToFive(value) {
  return Math.ceil(num(value) / 5) * 5;
}
function floorToFive(value) {
  return Math.floor(num(value) / 5) * 5;
}
function randomFiveWeight(min, max) {
  const low = ceilToFive(min);
  const high = floorToFive(max);
  if (low > high) return null;
  const steps = Math.floor((high - low) / 5);
  return low + Math.floor(Math.random() * (steps + 1)) * 5;
}

function shuffled(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildUniqueNetWeights(count, total, min, max) {
  if (count <= 0) return null;
  const availableCount = Math.floor((max - min) / 5) + 1;
  if (availableCount < count || total % 5 !== 0) return null;

  const result = [];
  const used = new Set();

  function boundsForRemaining(remainingCount, excluded) {
    const available = [];
    for (let value = min; value <= max; value += 5) {
      if (!excluded.has(value)) available.push(value);
    }
    if (available.length < remainingCount) return null;
    const minSum = available.slice(0, remainingCount).reduce((a, b) => a + b, 0);
    const maxSum = available.slice(-remainingCount).reduce((a, b) => a + b, 0);
    return { minSum, maxSum };
  }

  function search(index, remainingTotal) {
    const remainingCount = count - index;
    if (remainingCount === 0) return remainingTotal === 0;

    if (remainingCount === 1) {
      if (
        remainingTotal >= min &&
        remainingTotal <= max &&
        remainingTotal % 5 === 0 &&
        !used.has(remainingTotal)
      ) {
        result.push(remainingTotal);
        return true;
      }
      return false;
    }

    let low = Math.max(min, remainingTotal - (remainingCount - 1) * max);
    let high = Math.min(max, remainingTotal - (remainingCount - 1) * min);
    low = ceilToFive(low);
    high = floorToFive(high);
    if (low > high) return false;

    const candidates = [];
    for (let value = low; value <= high; value += 5) {
      if (!used.has(value)) candidates.push(value);
    }

    for (const value of shuffled(candidates)) {
      // 相鄰車次至少差 10 kg，避免視覺上過度規律或幾乎相同。
      if (result.length && Math.abs(result[result.length - 1] - value) < 10) continue;
      used.add(value);
      const bounds = boundsForRemaining(remainingCount - 1, used);
      const nextTotal = remainingTotal - value;
      if (bounds && nextTotal >= bounds.minSum && nextTotal <= bounds.maxSum) {
        result.push(value);
        if (search(index + 1, nextTotal)) return true;
        result.pop();
      }
      used.delete(value);
    }
    return false;
  }

  return search(0, total) ? result : null;
}


function arrangeNaturalNetWeights(weights) {
  if (!Array.isArray(weights) || weights.length < 2) return weights;

  const sorted = [...weights].sort((a, b) => a - b);
  const roll = Math.random();
  let tailPool;
  let strategy;

  if (roll < 0.3) {
    tailPool = [sorted[0]];
    strategy = "lightest";
  } else if (roll < 0.6) {
    tailPool = [sorted[sorted.length - 1]];
    strategy = "heaviest";
  } else {
    tailPool = sorted.slice(1, -1);
    if (!tailPool.length) tailPool = [...sorted];
    strategy = "middle";
  }

  // 嘗試多種排列，確保相鄰兩台至少相差 10 kg，尾車則依本批策略落在最輕、最重或中間。
  for (let attempt = 0; attempt < 1500; attempt++) {
    const tail = tailPool[Math.floor(Math.random() * tailPool.length)];
    const remaining = shuffled(weights.filter((value) => value !== tail));
    const candidate = [...remaining, tail];
    const natural = candidate.every(
      (value, index) => index === 0 || Math.abs(value - candidate[index - 1]) >= 10,
    );
    if (natural) {
      candidate.tailStrategy = strategy;
      return candidate;
    }
  }

  // 極窄 range 下若無法排出理想順序，保留原本已符合總重與不重複條件的結果。
  return weights;
}

function buildRecordPlan() {
  const s = settings();
  const err = validateSettings(s);
  if (err) {
    showMessage(err);
    return null;
  }

  const vehicles = selectedVehicles(s);
  const targetKg = Math.round(s.targetTons * 1000);
  const netMin5 = ceilToFive(s.netMin);
  const netMax5 = floorToFive(s.netMax);
  if (netMin5 > netMax5) {
    showMessage("淨重範圍內沒有可用的 5 kg 倍數，請調整淨重 Min／Max。");
    return null;
  }
  let clock = minutes(s.startTime);
  let dayOffset = 0;
  let index = 0;
  const lastUse = new Map();
  const slots = [];
  // 業主規則：目標累計淨重 = 每車「淨重」的累計，不包含空車重。

  // 先排出車次，直到目標重量落在「所有車皆符合淨重 range」的可行區間內。
  while (index < 10000) {
    let chosen = null;
    let tries = 0;

    while (!chosen && tries < 5000) {
      for (let offset = 0; offset < vehicles.length; offset++) {
        const v = vehicles[(index + offset) % vehicles.length];
        const absolute = dayOffset * 1440 + clock;
        const last = lastUse.get(v.vehicleNo);
        if (last === undefined || absolute - last >= 120) {
          chosen = v;
          break;
        }
      }

      if (!chosen) {
        clock += randomInteger(s.intervalMin, s.intervalMax);
        if (clock >= 1440) {
          dayOffset += Math.floor(clock / 1440);
          clock %= 1440;
        }
        tries++;
      }
    }

    if (!chosen) {
      showMessage("無法排出符合兩小時限制的車次。");
      return null;
    }

    const tareSource = s.tareHint > 0 ? s.tareHint : chosen.tareWeight;
    const tare = num(tareSource);
    if (tare <= 0) {
      showMessage(`車號 ${chosen.vehicleNo} 的空車重不正確。`);
      return null;
    }

    const absolute = dayOffset * 1440 + clock;
    lastUse.set(chosen.vehicleNo, absolute);
    slots.push({
      chosen,
      tare,
      date: addDays(s.date, dayOffset),
      departureTime: timeText(clock),
    });
    index++;

    const minPossible = index * netMin5;
    const maxPossible = index * netMax5;
    const isFiveAligned = targetKg % 5 === 0;

    if (
      targetKg >= minPossible &&
      targetKg <= maxPossible &&
      isFiveAligned
    ) break;

    // 最小可能重量已大於目標，增加車次只會更重，代表目前條件無解。
    if (minPossible > targetKg) {
      showMessage(
        `無法在淨重 ${fi(s.netMin)}～${fi(s.netMax)} kg（生成值以 5 kg 為單位）的設定範圍內，精準組成 ${ft(s.targetTons)} 公噸。請調整目標重量、淨重範圍或車輛空車重。`,
      );
      return null;
    }

    clock += randomInteger(s.intervalMin, s.intervalMax);
    if (clock >= 1440) {
      dayOffset += Math.floor(clock / 1440);
      clock %= 1440;
    }
  }

  if (!slots.length || slots.length >= 10000) {
    showMessage("生成筆數過多，請檢查重量設定。");
    return null;
  }

  // 分配不重複淨重；每一筆為 5 kg 倍數，並保留尾車可行空間。
  const totalNetNeeded = targetKg;
  const calculatedNetWeights = buildUniqueNetWeights(
    slots.length,
    totalNetNeeded,
    netMin5,
    netMax5,
  );

  if (!calculatedNetWeights) {
    showMessage(
      `無法在淨重 ${fi(s.netMin)}～${fi(s.netMax)} kg 的範圍內，同時達成「每台淨重不重複、以 5 kg 為單位、累計淨重精準吻合」。請放寬淨重範圍或調整目標重量。`,
    );
    return null;
  }

  const netWeights = arrangeNaturalNetWeights(calculatedNetWeights);

  let cumulativeNet = 0;
  const records = slots.map((slot, i) => {
    const net = netWeights[i];
    const gross = slot.tare + net;
    cumulativeNet += net;
    return {
      id: uid(),
      tripNo: i + 1,
      date: slot.date,
      departureTime: slot.departureTime,
      vehicleNo: slot.chosen.vehicleNo,
      driver: s.driver || "",
      deliveryNo: nextDeliveryNo(s.deliveryNoStart, i),
      documentType: s.documentType,
      tareWeight: slot.tare,
      netWeight: net,
      grossWeight: gross,
      cumulativeTons: cumulativeNet / 1000,
      customer: s.customer,
      location: s.location,
      productName: s.productName,
      consignment: s.consignment,
      dispatcher: s.dispatcher,
      qualityControl: s.qualityControl,
      supervisor: s.supervisor,
      temperature: s.temperature,
      oilLarge: s.oilLarge,
      oilSmall: s.oilSmall,
      note: s.note,
      createdAt: new Date().toISOString(),
      conditionSnapshot: {
        netMin: s.netMin,
        netMax: s.netMax,
        targetTons: s.targetTons,
        intervalMin: s.intervalMin,
        intervalMax: s.intervalMax,
      },
    };
  });

  const last = records.at(-1);
  const actualTons = last?.cumulativeTons || 0;
  return {
    records,
    targetTons: s.targetTons,
    actualTons,
    overTons: actualTons - s.targetTons,
    endDate: last?.date || "",
    endTime: last?.departureTime || "",
  };
}

function previewAndConfirmGenerate() {
  const plan = buildRecordPlan();
  if (!plan) return;

  const overText =
    plan.overTons > 0
      ? `\n超過目標：${ft(plan.overTons)} 公噸`
      : "\n未超過目標重量";
  const previewText =
    `試算結果：\n\n` +
    `預計產生：${plan.records.length} 車\n` +
    `累計淨重：${ft(plan.actualTons)} 公噸\n` +
    `目標重量：${ft(plan.targetTons)} 公噸` +
    `${overText}\n` +
    `結束時間：${plan.endDate} ${plan.endTime}\n\n` +
    `確認後將一鍵生成以上資料，是否繼續？`;

  showMessage(
    `試算結果：預計產生 ${plan.records.length} 車，累計淨重 ${ft(plan.actualTons)} 公噸${plan.overTons > 0 ? `，超過目標 ${ft(plan.overTons)} 公噸` : ""}，結束時間 ${plan.endDate} ${plan.endTime}。`,
  );

  if (!confirm(previewText)) return;
  if (state.records.length && !confirm("生成後會取代目前結果，是否繼續？")) return;

  state.records = plan.records;
  save();
  renderRecords();
  showMessage("");
  toast(`已自動生成 ${plan.records.length} 筆車輛資料`);
}
function recalc() {
  state.records.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.departureTime.localeCompare(b.departureTime),
  );
  let total = 0;
  state.records.forEach((r, i) => {
    r.tripNo = i + 1;
    r.grossWeight = num(r.tareWeight) + num(r.netWeight);
    total += num(r.netWeight);
    r.cumulativeTons = total / 1000;
  });
}
function recordWarnings(candidate, id = "") {
  const s = settings(),
    warnings = [];
  if (candidate.netWeight < s.netMin || candidate.netWeight > s.netMax)
    warnings.push(
      `淨重 ${fi(candidate.netWeight)} kg 超出設定區間 ${fi(s.netMin)}～${fi(s.netMax)} kg`,
    );
  const projected =
    state.records
      .filter((x) => x.id !== id)
      .reduce((sum, x) => sum + num(x.netWeight), 0) +
    candidate.netWeight;
  if (projected > s.targetTons * 1000)
    warnings.push(
      `儲存後累計淨重為 ${ft(projected / 1000)} 公噸，超過目標 ${ft(s.targetTons)} 公噸`,
    );
  if (s.vehicleMode === "single" && candidate.vehicleNo !== s.singleVehicleNo)
    warnings.push(`車號與目前指定車號 ${s.singleVehicleNo} 不同`);
  return warnings;
}
function renderRecords() {
  recalc();
  const total = state.records.reduce((s, r) => s + num(r.netWeight), 0),
    target = settings().targetTons;
  const over = target > 0 && total / 1000 > target;
  el("recordSummary").textContent =
    `${state.records.length} 筆・累計淨重 ${ft(total / 1000)} 公噸${over ? `（超過目標 ${ft(total / 1000 - target)} 噸）` : ""}`;
  el("recordTbody").innerHTML = state.records.length
    ? state.records
        .map(
          (r) => `<tr>
<td><span class="status-pill">${r.tripNo}</span></td>
<td>${esc(r.customer)}</td><td>${esc(r.location)}</td><td>${esc(r.driver || "—")}</td><td><strong>${esc(r.vehicleNo)}</strong></td>
<td>${esc(r.deliveryNo)}</td><td>${esc(r.documentType)}</td><td class="num">${fi(r.tareWeight)}</td><td class="num">${fi(r.netWeight)}</td><td class="num">${fi(r.grossWeight)}</td><td class="num">${ft(r.cumulativeTons)}</td><td>${esc(r.productName || "—")}</td>
<td>${r.date}</td>
<td>${r.departureTime}</td>

<td>${esc(r.oilLarge || "—")}</td><td>${esc(r.oilSmall || "—")}</td>

<td>${esc(r.consignment || "—")}</td><td>${esc(r.dispatcher || "—")}</td><td>${esc(r.qualityControl || "—")}</td><td>${esc(r.supervisor || "—")}</td><td>${esc(r.temperature || "—")}</td><td class="note-cell">${esc(r.note || "—")}</td>
<td><button class="action-link" data-action="edit-record" data-id="${r.id}">編輯</button><button class="action-link danger" data-action="delete-record" data-id="${r.id}">刪除</button></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="23" class="empty-cell">尚未生成資料</td></tr>';
  save();
}
function openVehicle(i = "") {
  const v = i === "" ? null : state.vehicles[Number(i)];
  el("vehicleEditIndex").value = i;
  el("vehicleDialogTitle").textContent = v ? "編輯車輛" : "新增車輛";
  el("vehicleDialogNo").value = v?.vehicleNo || "";
  el("vehicleDialogTare").value = v?.tareWeight || "";
  el("vehicleDialog").showModal();
}
function saveVehicle(e) {
  e.preventDefault();
  const raw = el("vehicleEditIndex").value,
    no = el("vehicleDialogNo").value.trim().toUpperCase(),
    tare = num(el("vehicleDialogTare").value);
  if (!no || tare <= 0) return;
  if (state.vehicles.some((v, i) => v.vehicleNo === no && String(i) !== raw))
    return alert("車號已存在");
  if (raw === "")
    state.vehicles.push({ vehicleNo: no, tareWeight: tare, enabled: true });
  else
    state.vehicles[Number(raw)] = {
      ...state.vehicles[Number(raw)],
      vehicleNo: no,
      tareWeight: tare,
    };
  save();
  renderVehicles();
  el("vehicleDialog").close();
}
function setGrossPreview() {
  el("rdGross").value = num(el("rdTare").value) + num(el("rdNet").value);
}
function openRecord(id = "") {
  const r = id
    ? state.records.find((x) => x.id === id)
    : {
        customer: el("customer").value,
        location: el("location").value,
        driver: el("driver").value,
        vehicleNo: "",
        deliveryNo: "",
        documentType: el("documentType").value,
        tareWeight: 0,
        netWeight: 0,
        productName: el("productName").value,
        date: el("date").value,
        departureTime: el("startTime").value,
        oilLarge: el("oilLarge").value,
        oilSmall: el("oilSmall").value,
            consignment: el("consignment").value,
        dispatcher: el("dispatcher").value,
        qualityControl: el("qualityControl").value,
        supervisor: el("supervisor").value,
        temperature: el("temperature").value,
        note: el("note").value,
      };
  el("recordEditId").value = id;
  el("recordDialogTitle").textContent = id ? "編輯生成資料" : "新增一筆資料";
  el("recordWarning").hidden = true;
  [
    ["rdCustomer", "customer"],
    ["rdLocation", "location"],
    ["rdDriver", "driver"],
    ["rdVehicleNo", "vehicleNo"],
    ["rdDeliveryNo", "deliveryNo"],
    ["rdType", "documentType"],
    ["rdTare", "tareWeight"],
    ["rdNet", "netWeight"],
    ["rdProduct", "productName"],
    ["rdDate", "date"],
    ["rdTime", "departureTime"],
    ["rdOilLarge", "oilLarge"],
    ["rdOilSmall", "oilSmall"],
    ["rdConsignment", "consignment"],
    ["rdDispatcher", "dispatcher"],
    ["rdQualityControl", "qualityControl"],
    ["rdSupervisor", "supervisor"],
    ["rdTemperature", "temperature"],
    ["rdNote", "note"],
  ].forEach(([a, b]) => (el(a).value = r[b] ?? ""));
  setGrossPreview();
  el("recordDialog").showModal();
}
function saveRecord(e) {
  e.preventDefault();
  const id = el("recordEditId").value;
  const r = {
    id: id || uid(),
    customer: el("rdCustomer").value.trim(),
    location: el("rdLocation").value.trim(),
    driver: el("rdDriver").value.trim(),
    vehicleNo: el("rdVehicleNo").value.trim().toUpperCase(),
    deliveryNo: el("rdDeliveryNo").value.trim(),
    documentType: el("rdType").value,
    tareWeight: num(el("rdTare").value),
    netWeight: num(el("rdNet").value),
    productName: el("rdProduct").value.trim(),
    date: el("rdDate").value,
    departureTime: el("rdTime").value,
    oilLarge: el("rdOilLarge").value.trim(),
    oilSmall: el("rdOilSmall").value.trim(),
    consignment: el("rdConsignment").value.trim(),
    dispatcher: el("rdDispatcher").value.trim(),
    qualityControl: el("rdQualityControl").value.trim(),
    supervisor: el("rdSupervisor").value.trim(),
    temperature: el("rdTemperature").value.trim(),
    note: el("rdNote").value.trim(),
    createdAt: new Date().toISOString(),
  };
  if (
    !r.customer ||
    !r.location ||
    !r.deliveryNo ||
    !r.date ||
    !r.departureTime ||
    !r.vehicleNo ||
    r.tareWeight <= 0 ||
    r.netWeight <= 0
  )
    return alert("請填寫必要資料");
  const conflict = state.records.find(
    (x) =>
      x.id !== id &&
      x.date === r.date &&
      x.vehicleNo === r.vehicleNo &&
      Math.abs(minutes(x.departureTime) - minutes(r.departureTime)) < 120,
  );
  if (conflict)
    return alert(
      `同車 ${r.vehicleNo} 與 ${conflict.departureTime} 間隔未滿兩小時，禁止儲存。`,
    );
  const warnings = recordWarnings(r, id);
  if (
    warnings.length &&
    !confirm(
      `資料超出目前設定條件：\n\n• ${warnings.join("\n• ")}\n\n仍要儲存嗎？`,
    )
  ) {
    el("recordWarning").textContent = warnings.join("；");
    el("recordWarning").hidden = false;
    return;
  }
  if (id)
    state.records[state.records.findIndex((x) => x.id === id)] = {
      ...state.records.find((x) => x.id === id),
      ...r,
    };
  else state.records.push(r);
  recalc();
  save();
  renderRecords();
  el("recordDialog").close();
  toast(
    warnings.length ? "已儲存，資料含條件警告" : "資料已儲存並重新連動計算",
  );
}
function parseRows(rows) {
  return rows
    .map((row) => {
      const ks = Object.keys(row),
        nk = ks.find((k) => /車號|車牌|vehicle/i.test(k)),
        tk = ks.find((k) => /空車|空重|tare/i.test(k));
      return nk && tk
        ? {
            vehicleNo: String(row[nk] || "")
              .trim()
              .toUpperCase(),
            tareWeight: num(row[tk]),
            enabled: true,
          }
        : null;
    })
    .filter((v) => v && v.vehicleNo && v.tareWeight > 0);
}
async function importExcel(file) {
  if (typeof XLSX === "undefined") return alert("Excel 模組未載入");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" }),
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
      defval: "",
    }),
    parsed = parseRows(rows);
  if (!parsed.length) return alert("找不到車號與空車重欄位");
  const map = new Map(state.vehicles.map((v) => [v.vehicleNo, v]));
  parsed.forEach((v) =>
    map.set(v.vehicleNo, { ...map.get(v.vehicleNo), ...v }),
  );
  state.vehicles = [...map.values()];
  save();
  renderVehicles();
  toast(`匯入 ${parsed.length} 筆車輛`);
}
function pick(row, patterns) {
  const key = Object.keys(row).find((k) =>
    patterns.some((p) => p.test(String(k).trim())),
  );
  return key ? row[key] : "";
}
function excelDate(v) {
  if (!v) return "";
  if (typeof v === "number" && typeof XLSX !== "undefined") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d)
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const t = String(v).trim().replaceAll("/", "-");
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : t;
}
function excelTime(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") {
    const mins = Math.round((v % 1) * 1440);
    return timeText(mins);
  }
  const t = String(v).trim();
  const m = t.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : t;
}
function parseRecordRows(rows) {
  return rows
    .map((row, i) => {
      const vehicleNo = String(pick(row, [/^車號$/, /車牌/, /vehicle/i]) || "")
        .trim()
        .toUpperCase();
      const date = excelDate(pick(row, [/^日期$/, /date/i]));
      const departureTime = excelTime(
        pick(row, [/出廠時間/, /^時間$/, /departure/i]),
      );
      const tareWeight = num(pick(row, [/空車重/, /^空重$/, /tare/i]));
      const netWeight = num(pick(row, [/^淨重$/, /net/i]));
      if (
        !vehicleNo ||
        !date ||
        !departureTime ||
        tareWeight <= 0 ||
        netWeight <= 0
      )
        return null;
      return {
        id: uid(),
        tripNo: num(pick(row, [/交貨車次/, /^車次$/])) || i + 1,
        date,
        departureTime,
        customer: String(pick(row, [/客戶名稱/, /^客戶$/]) || "").trim(),
        location: String(pick(row, [/送貨地點/, /^地點$/]) || "").trim(),
        deliveryNo: String(pick(row, [/交貨單號/, /^單號$/]) || "").trim(),
        vehicleNo,
        driver: String(
          pick(row, [/^承運公司$/, /^司機$/, /driver/i]) || "",
        ).trim(),
        tareWeight,
        netWeight,
        grossWeight:
          num(pick(row, [/^總重量$/, /^總重$/, /gross/i])) ||
          tareWeight + netWeight,
        cumulativeTons: num(pick(row, [/累計淨重/, /累計總重/])),
        productName: String(pick(row, [/^品名$/]) || "").trim(),
        documentType: String(
          pick(row, [/單據類型/, /進.*出料單/]) || "出料單",
        ).trim(),
        oilLarge: String(pick(row, [/冷油.*大桶/, /^大桶$/]) || "").trim(),
        oilSmall: String(pick(row, [/冷油.*小桶/, /^小桶$/]) || "").trim(),
        consignment: String(pick(row, [/^托運$/]) || "").trim(),
        dispatcher: String(pick(row, [/^調度員$/, /^調度$/]) || "").trim(),
        qualityControl: String(pick(row, [/^品管$/]) || "").trim(),
        supervisor: String(pick(row, [/^監造$/]) || "").trim(),
        temperature: String(pick(row, [/^溫度$/]) || "").trim(),
        note: String(pick(row, [/^備註$/]) || "").trim(),
        createdAt: new Date().toISOString(),
        imported: true,
      };
    })
    .filter(Boolean);
}
async function importRecordsExcel(file) {
  if (typeof XLSX === "undefined") return alert("Excel 模組未載入");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" }),
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
      defval: "",
      raw: true,
    }),
    parsed = parseRecordRows(rows);
  if (!parsed.length)
    return alert(
      "找不到可匯入的交貨資料。請確認至少包含：日期、出廠時間、車號、空車重、淨重。",
    );
  if (
    state.records.length &&
    !confirm(
      `目前已有 ${state.records.length} 筆資料。\n\n按「確定」將以匯入表單取代目前資料；按「取消」則不匯入。`,
    )
  )
    return;
  state.records = parsed;
  recalc();
  save();
  renderRecords();
  toast(`已匯入 ${parsed.length} 筆交貨資料，可編輯、匯出或重印`);
}
function exportBook(name, sheet, rows, widths) {
  if (typeof XLSX === "undefined") return alert("Excel 模組未載入");
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, name);
}
function exportVehicles() {
  exportBook(
    `車輛主檔_${today.replaceAll("-", "")}.xlsx`,
    "車輛主檔",
    state.vehicles.map((v) => ({
      啟用: v.enabled ? "是" : "否",
      車號: v.vehicleNo,
      空車重: v.tareWeight,
    })),
    [8, 16, 14],
  );
}
function exportRecords() {
  if (!state.records.length) return alert("沒有資料");
  exportBook(
    `自動排程_${el("date").value.replaceAll("-", "")}.xlsx`,
    "交貨資料",
    state.records.map((r) => ({
      交貨車次: r.tripNo,
      客戶名稱: r.customer,
      送貨地點: r.location,
      承運公司: r.driver,
      車號: r.vehicleNo,
      交貨單號: r.deliveryNo,
      進出料單: r.documentType,
      空車重: r.tareWeight,
      淨重: r.netWeight,
      總重量: r.grossWeight,
      累計淨重: r.cumulativeTons,
      品名: r.productName,
      日期: r.date,
      出廠時間: r.departureTime,
      冷油大桶: r.oilLarge || "",
      冷油小桶: r.oilSmall || "",
      托運: r.consignment || "",
      調度: r.dispatcher || "",
      品管: r.qualityControl || "",
      監造: r.supervisor || "",
      溫度: r.temperature || "",
      備註: r.note,
    })),
    [
      10, 18, 18, 16, 15, 18, 12, 12, 12, 12, 16, 14, 13, 11, 12, 12, 12, 10,
      10, 10, 10, 24,
    ],
  );
}


// ===== 點陣機 Excel 匯出 V3：完整保留廠商原始版型 =====
//
// 舊版使用 SheetJS 讀寫模板，會遺失 Excel Drawing/Text Box，導致「調度」文字
// 方塊、字型、字級、直排方向與列印版型不完全一致。
// V3 改為直接修改 XLSX（OOXML ZIP）內部 XML：
// 1. 原始 A:S / 1:12 的儲存格樣式、欄寬、列高、合併、頁面設定全部保留。
// 2. 「調度」沿用原檔真正的文字方塊（標楷體 15pt、直排），只替換姓名。
// 3. 每一車完整複製一份原始頁面，輸出成同一本 Excel 的「車次01、車次02…」。
// 4. 不保留原檔右側資料庫，也不帶第二張原始資料表。
// 5. 原始印表機設定 printerSettings 也逐頁複製。
const PRINTER_TEMPLATE_BASE64 = "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";

const OOXML_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";

function rocDate(dateText) {
  const m = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(dateText || "").replaceAll("-", "/");
  return `${Number(m[1]) - 1911}/${m[2]}/${m[3]}`;
}

function printerDocumentText(type) {
  const t = String(type || "").trim();
  if (t.includes("進")) return "進料";
  if (t.includes("出")) return "出料";
  return t;
}

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const error = doc.getElementsByTagName("parsererror")[0];
  if (error) throw new Error("Excel XML 解析失敗：" + error.textContent);
  return doc;
}

function serializeXml(doc) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    new XMLSerializer().serializeToString(doc.documentElement);
}

function excelColumnNumber(address) {
  const m = String(address).match(/^([A-Z]+)/i);
  if (!m) return 0;
  return [...m[1].toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

function excelRowNumber(address) {
  const m = String(address).match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function childElementsByLocalName(node, localName) {
  return [...node.childNodes].filter((n) => n.nodeType === 1 && n.localName === localName);
}

function setOoxmlCell(doc, address, value, numeric = false) {
  const cells = [...doc.getElementsByTagNameNS(OOXML_NS, "c")];
  const cell = cells.find((c) => c.getAttribute("r") === address);
  if (!cell) throw new Error(`原始模板找不到儲存格 ${address}`);

  childElementsByLocalName(cell, "f").forEach((n) => n.remove());
  childElementsByLocalName(cell, "v").forEach((n) => n.remove());
  childElementsByLocalName(cell, "is").forEach((n) => n.remove());

  if (numeric) {
    cell.removeAttribute("t");
    const v = doc.createElementNS(OOXML_NS, "v");
    v.textContent = String(Number(value || 0));
    cell.appendChild(v);
  } else {
    cell.setAttribute("t", "inlineStr");
    const is = doc.createElementNS(OOXML_NS, "is");
    const t = doc.createElementNS(OOXML_NS, "t");
    t.setAttribute("xml:space", "preserve");
    t.textContent = String(value ?? "");
    is.appendChild(t);
    cell.appendChild(is);
  }
}

function cropTemplateSheet(doc) {
  // 只保留業主真正要列印的 A:S、1:12；清掉右側資料庫及下方資料。
  [...doc.getElementsByTagNameNS(OOXML_NS, "row")].forEach((row) => {
    const rowNo = Number(row.getAttribute("r") || 0);
    if (rowNo > 12) {
      row.remove();
      return;
    }
    [...row.getElementsByTagNameNS(OOXML_NS, "c")].forEach((cell) => {
      const addr = cell.getAttribute("r") || "";
      if (excelColumnNumber(addr) > 19) cell.remove(); // S = 19
    });
  });

  const dimension = doc.getElementsByTagNameNS(OOXML_NS, "dimension")[0];
  if (dimension) dimension.setAttribute("ref", "A1:S12");

  // 原始資料庫的篩選設定不需要帶入。
  [...doc.getElementsByTagNameNS(OOXML_NS, "autoFilter")].forEach((n) => n.remove());
}

function fillPrinterSheetXml(templateXml, r) {
  const doc = parseXml(templateXml);
  cropTemplateSheet(doc);

  setOoxmlCell(doc, "N1", `NO:${r.deliveryNo || ""}`);
  setOoxmlCell(doc, "E3", r.customer || "");
  setOoxmlCell(doc, "L3", num(r.grossWeight), true);
  setOoxmlCell(doc, "E4", r.location || "");
  setOoxmlCell(doc, "L4", num(r.tareWeight), true);
  setOoxmlCell(doc, "E5", r.driver || "");
  setOoxmlCell(doc, "L5", num(r.netWeight), true);
  setOoxmlCell(doc, "E6", r.vehicleNo || "");
  setOoxmlCell(doc, "M6", r.productName || "");
  setOoxmlCell(doc, "E7", rocDate(r.date));
  setOoxmlCell(doc, "H7", r.departureTime || "");
  setOoxmlCell(doc, "J7", r.oilLarge === "" ? 0 : r.oilLarge || 0, true);
  setOoxmlCell(doc, "O7", r.oilSmall === "" ? 0 : r.oilSmall || 0, true);
  setOoxmlCell(doc, "R9", printerDocumentText(r.documentType));
  setOoxmlCell(doc, "R10", `第${r.tripNo || ""}車次`);
  setOoxmlCell(doc, "R11", "共");
  setOoxmlCell(doc, "R12", `${ft(r.cumulativeTons)}噸`);

  return serializeXml(doc);
}

function fillDispatcherDrawingXml(templateXml, dispatcher) {
  const doc = parseXml(templateXml);
  const anchors = [...doc.getElementsByTagNameNS(DRAWING_NS, "twoCellAnchor")];
  let dispatcherAnchor = null;

  anchors.forEach((anchor) => {
    const props = [...anchor.getElementsByTagNameNS(DRAWING_NS, "cNvPr")];
    const isDispatcher = props.some((p) => p.getAttribute("name") === "文字方塊 5");
    if (isDispatcher) dispatcherAnchor = anchor;
    else anchor.remove(); // 移除原檔列印區外的輔助文字方塊。
  });

  if (!dispatcherAnchor) throw new Error("原始模板找不到調度文字方塊");
  const texts = [...dispatcherAnchor.getElementsByTagNameNS(A_NS, "t")];
  if (!texts.length) throw new Error("調度文字方塊沒有文字節點");
  texts[0].textContent = String(dispatcher || "").trim();
  texts.slice(1).forEach((t) => (t.textContent = ""));
  return serializeXml(doc);
}

function buildSheetRelsXml(index) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${index}.xml"/><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/printerSettings" Target="../printerSettings/printerSettings${index}.bin"/></Relationships>`;
}

function rewriteWorkbookXml(templateXml, count) {
  const doc = parseXml(templateXml);
  const sheets = doc.getElementsByTagNameNS(OOXML_NS, "sheets")[0];
  while (sheets.firstChild) sheets.removeChild(sheets.firstChild);

  for (let i = 1; i <= count; i++) {
    const sheet = doc.createElementNS(OOXML_NS, "sheet");
    sheet.setAttribute("name", `車次${String(i).padStart(2, "0")}`);
    sheet.setAttribute("sheetId", String(i));
    sheet.setAttributeNS(REL_NS, "r:id", `rId${i}`);
    sheets.appendChild(sheet);
  }

  let definedNames = doc.getElementsByTagNameNS(OOXML_NS, "definedNames")[0];
  if (!definedNames) {
    definedNames = doc.createElementNS(OOXML_NS, "definedNames");
    sheets.parentNode.insertBefore(definedNames, sheets.nextSibling);
  }
  while (definedNames.firstChild) definedNames.removeChild(definedNames.firstChild);
  for (let i = 0; i < count; i++) {
    const dn = doc.createElementNS(OOXML_NS, "definedName");
    dn.setAttribute("name", "_xlnm.Print_Area");
    dn.setAttribute("localSheetId", String(i));
    dn.textContent = `'車次${String(i + 1).padStart(2, "0")}'!$A$1:$S$12`;
    definedNames.appendChild(dn);
  }

  const calcPr = doc.getElementsByTagNameNS(OOXML_NS, "calcPr")[0];
  if (calcPr) calcPr.setAttribute("fullCalcOnLoad", "1");
  return serializeXml(doc);
}

function rewriteWorkbookRelsXml(templateXml, count) {
  const doc = parseXml(templateXml);
  const root = doc.documentElement;
  while (root.firstChild) root.removeChild(root.firstChild);

  const addRel = (id, type, target) => {
    const rel = doc.createElementNS(PKG_REL_NS, "Relationship");
    rel.setAttribute("Id", id);
    rel.setAttribute("Type", type);
    rel.setAttribute("Target", target);
    root.appendChild(rel);
  };

  for (let i = 1; i <= count; i++) {
    addRel(`rId${i}`, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet", `worksheets/sheet${i}.xml`);
  }
  let id = count + 1;
  addRel(`rId${id++}`, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme", "theme/theme1.xml");
  addRel(`rId${id++}`, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles", "styles.xml");
  addRel(`rId${id++}`, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings", "sharedStrings.xml");
  return serializeXml(doc);
}

function rewriteContentTypesXml(templateXml, count) {
  const doc = parseXml(templateXml);
  const root = doc.documentElement;
  [...root.getElementsByTagNameNS(CT_NS, "Override")].forEach((node) => {
    const part = node.getAttribute("PartName") || "";
    if (/^\/xl\/worksheets\/sheet\d+\.xml$/.test(part) ||
        /^\/xl\/drawings\/drawing\d+\.xml$/.test(part) ||
        part === "/xl/calcChain.xml") {
      node.remove();
    }
  });

  const addOverride = (part, type) => {
    const o = doc.createElementNS(CT_NS, "Override");
    o.setAttribute("PartName", part);
    o.setAttribute("ContentType", type);
    root.appendChild(o);
  };
  for (let i = 1; i <= count; i++) {
    addOverride(`/xl/worksheets/sheet${i}.xml`, "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml");
    addOverride(`/xl/drawings/drawing${i}.xml`, "application/vnd.openxmlformats-officedocument.drawing+xml");
  }
  return serializeXml(doc);
}

async function exportPrinterWorkbook() {
  if (!state.records.length) return alert("目前沒有生成資料，請先試算或匯入交貨表單。");
  if (typeof JSZip === "undefined") return alert("點陣機 Excel 模組未載入，請確認網路連線後重新整理。");

  const btn = el("printerExportBtn");
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "產生點陣機檔案中…";

  try {
    const zip = await JSZip.loadAsync(PRINTER_TEMPLATE_BASE64, { base64: true });
    const templateSheetXml = await zip.file("xl/worksheets/sheet1.xml").async("string");
    const templateDrawingXml = await zip.file("xl/drawings/drawing1.xml").async("string");
    const templatePrinter = await zip.file("xl/printerSettings/printerSettings1.bin").async("uint8array");
    const workbookXml = await zip.file("xl/workbook.xml").async("string");
    const workbookRelsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
    const contentTypesXml = await zip.file("[Content_Types].xml").async("string");

    // 清除原來的兩張工作表/繪圖/印表機設定與計算鏈，再依車次完整複製母版。
    Object.keys(zip.files).forEach((name) => {
      if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name) ||
          /^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(name) ||
          /^xl\/drawings\/drawing\d+\.xml$/.test(name) ||
          /^xl\/printerSettings\/printerSettings\d+\.bin$/.test(name) ||
          name === "xl/calcChain.xml") {
        zip.remove(name);
      }
    });

    state.records.forEach((r, idx) => {
      const i = idx + 1;
      zip.file(`xl/worksheets/sheet${i}.xml`, fillPrinterSheetXml(templateSheetXml, r));
      zip.file(`xl/worksheets/_rels/sheet${i}.xml.rels`, buildSheetRelsXml(i));
      zip.file(`xl/drawings/drawing${i}.xml`, fillDispatcherDrawingXml(templateDrawingXml, r.dispatcher));
      zip.file(`xl/printerSettings/printerSettings${i}.bin`, templatePrinter);
    });

    zip.file("xl/workbook.xml", rewriteWorkbookXml(workbookXml, state.records.length));
    zip.file("xl/_rels/workbook.xml.rels", rewriteWorkbookRelsXml(workbookRelsXml, state.records.length));
    zip.file("[Content_Types].xml", rewriteContentTypesXml(contentTypesXml, state.records.length));

    const blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const batchDate = (state.records[0]?.date || el("date").value || today).replaceAll("-", "");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `點陣機料單_${batchDate}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    toast(`已下載點陣機檔案，共 ${state.records.length} 車次；每頁完整保留原始文字方塊與格式`);
  } catch (err) {
    console.error(err);
    alert("點陣機檔案產生失敗。\n\n" + (err?.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

el("vehicleTbody").addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const i = Number(t.dataset.index),
    a = t.dataset.action;
  if (a === "toggle") {
    state.vehicles[i].enabled = t.checked;
    save();
    renderVehicles();
  }
  if (a === "edit") openVehicle(i);
  if (a === "delete" && confirm(`刪除 ${state.vehicles[i].vehicleNo}？`)) {
    state.vehicles.splice(i, 1);
    save();
    renderVehicles();
  }
});
el("recordTbody").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  if (b.dataset.action === "edit-record") openRecord(b.dataset.id);
  if (b.dataset.action === "delete-record" && confirm("確定刪除此筆？")) {
    state.records = state.records.filter((r) => r.id !== b.dataset.id);
    renderRecords();
  }
});
el("generatorForm").addEventListener("submit", (e) => {
  e.preventDefault();
  previewAndConfirmGenerate();
});
["netMin", "netMax", "targetTons", "intervalMin", "intervalMax", "tareHint"].forEach(
  (id) => el(id).addEventListener("input", updateEstimate),
);
el("vehicleMode").addEventListener("change", () => {
  el("singleVehicleWrap").hidden = el("vehicleMode").value !== "single";
  updateEstimate();
});
el("singleVehicleNo").addEventListener("change", updateEstimate);
el("rdTare").addEventListener("input", setGrossPreview);
el("rdNet").addEventListener("input", setGrossPreview);
el("addVehicleBtn").onclick = () => openVehicle();
el("vehicleForm").onsubmit = saveVehicle;
el("cancelVehicleBtn").onclick = () => el("vehicleDialog").close();
el("vehicleSearch").oninput = renderVehicles;
el("excelFile").onchange = async (e) => {
  if (e.target.files[0]) await importExcel(e.target.files[0]);
  e.target.value = "";
};
el("recordsExcelFile").onchange = async (e) => {
  if (e.target.files[0]) await importRecordsExcel(e.target.files[0]);
  e.target.value = "";
};
el("exportVehiclesBtn").onclick = exportVehicles;
el("printerExportBtn").onclick = exportPrinterWorkbook;
el("exportRecordsBtn").onclick = exportRecords;
el("addRecordBtn").onclick = () => openRecord();
el("recordForm").onsubmit = saveRecord;
el("cancelRecordBtn").onclick = () => el("recordDialog").close();
el("clearRecordsBtn").onclick = () => {
  if (confirm("清除全部生成資料？")) {
    state.records = [];
    renderRecords();
  }
};
el("resetSettingsBtn").onclick = () => {
  el("generatorForm").reset();
  el("date").value = today;
  el("singleVehicleWrap").hidden = true;
  updateEstimate();
};
el("date").value = today;
renderVehicles();
renderRecords();
updateEstimate();
