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
const today = new Date().toISOString().slice(0, 10);
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
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
    interval: num(el("intervalMinutes").value),
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
  if (s.targetTons <= 0 || s.interval <= 0)
    return "目標累計總重量與間隔時間必須大於 0。";
  if (!selectedVehicles(s).length) return "請至少選擇一輛車。";
  return "";
}
function updateEstimate() {
  const s = settings();
  const count = selectedVehicles(s).length;
  const msg =
    count && count * s.interval < 120
      ? `目前 ${count} 輛車 × ${s.interval} 分鐘＝${count * s.interval} 分鐘，小於同車 120 分鐘限制；試算時系統會自動延後衝突車次。`
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
function nextDeliveryNo(base, index) {
  const m = base.match(/^(.*?)(\d+)$/);
  if (!m) return `${base}-${String(index + 1).padStart(3, "0")}`;
  return m[1] + String(Number(m[2]) + index).padStart(m[2].length, "0");
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
  let cumulativeGross = 0;
  let clock = minutes(s.startTime);
  let dayOffset = 0;
  let index = 0;
  const lastUse = new Map();
  const records = [];

  while (cumulativeGross < targetKg && index < 10000) {
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
        clock += s.interval;
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

    const tare = s.tareHint > 0 ? s.tareHint : num(chosen.tareWeight);
    let net = randomWeight(s.netMin, s.netMax);
    let gross = tare + net;
    const remaining = targetKg - cumulativeGross;

    if (remaining < gross) {
      const adjustedNet = remaining - tare;
      if (adjustedNet >= s.netMin && adjustedNet <= s.netMax) {
        net = adjustedNet;
        gross = remaining;
      }
    }

    const absolute = dayOffset * 1440 + clock;
    lastUse.set(chosen.vehicleNo, absolute);
    cumulativeGross += gross;
    records.push({
      id: uid(),
      tripNo: index + 1,
      date: addDays(s.date, dayOffset),
      departureTime: timeText(clock),
      vehicleNo: chosen.vehicleNo,
      driver: s.driver || "",
      deliveryNo: nextDeliveryNo(s.deliveryNoStart, index),
      documentType: s.documentType,
      tareWeight: tare,
      netWeight: net,
      grossWeight: gross,
      cumulativeTons: cumulativeGross / 1000,
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
        interval: s.interval,
      },
    });

    clock += s.interval;
    if (clock >= 1440) {
      dayOffset += Math.floor(clock / 1440);
      clock %= 1440;
    }
    index++;
  }

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
    `累計總重量：${ft(plan.actualTons)} 公噸\n` +
    `目標重量：${ft(plan.targetTons)} 公噸` +
    `${overText}\n` +
    `結束時間：${plan.endDate} ${plan.endTime}\n\n` +
    `確認後將一鍵生成以上資料，是否繼續？`;

  showMessage(
    `試算結果：預計產生 ${plan.records.length} 車，累計總重量 ${ft(plan.actualTons)} 公噸${plan.overTons > 0 ? `，超過目標 ${ft(plan.overTons)} 公噸` : ""}，結束時間 ${plan.endDate} ${plan.endTime}。`,
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
    total += r.grossWeight;
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
      .reduce((sum, x) => sum + num(x.tareWeight) + num(x.netWeight), 0) +
    candidate.tareWeight +
    candidate.netWeight;
  if (projected > s.targetTons * 1000)
    warnings.push(
      `儲存後累計總重量為 ${ft(projected / 1000)} 公噸，超過目標 ${ft(s.targetTons)} 公噸`,
    );
  if (s.vehicleMode === "single" && candidate.vehicleNo !== s.singleVehicleNo)
    warnings.push(`車號與目前指定車號 ${s.singleVehicleNo} 不同`);
  return warnings;
}
function renderRecords() {
  recalc();
  const total = state.records.reduce((s, r) => s + num(r.grossWeight), 0),
    target = settings().targetTons;
  const over = target > 0 && total / 1000 > target;
  el("recordSummary").textContent =
    `${state.records.length} 筆・累計總重量 ${ft(total / 1000)} 公噸${over ? `（超過目標 ${ft(total / 1000 - target)} 噸）` : ""}`;
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
        cumulativeTons: num(pick(row, [/累計總重量/, /累計總重/])),
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
      累計總重量: r.cumulativeTons,
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
["netMin", "netMax", "targetTons", "intervalMinutes", "tareHint"].forEach(
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
