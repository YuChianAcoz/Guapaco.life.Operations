"use strict";

// ============================================================
// 點陣機模板設定集中區
// 之後如果廠商要求「字型 / 字級 / 儲存格位置」微調，只改這一支即可。
// ============================================================
const PRINTER_CONFIG = {
  xinzhaofeng: {
    customer: { cell: "E3", font: "新細明體", size: 16 },
    customerCode: { font: "Arial", size: 16.5 },
    deliveryNo: { cell: "N1", font: "Arial", size: 16 },
  },

  taisho: {
    // 依「大正料單 字型大小.jpg」整理。
    cells: {
      rocYear: "A2",
      month: "D2",
      day: "F2",
      documentType: "U2",
      tripNo: "AF3",
      customer: "D4",
      location: "D8",
      oilLarge: "AK8",
      oilSmall: "AK10",
      product: "AE12",
      driver: "E16",
      departureTime: "E18",
    },
    // 下列欄位在 Numbers 轉出的 Excel 中其實是「文字方塊」，不是儲存格。
    // 若把資料再寫進儲存格會造成兩份文字重疊，因此由 drawingShapes 控制。
    drawingShapes: {
      tareWeight: 0,
      grossWeight: 1,
      netWeight: 2,
      cumulativeTons: 3,
      vehicleNo: 4,
      dispatcher: 5,
      deliveryNo: 6,
    },
    fonts: {
      date: { font: "Meiryo", size: 12.5 },
      documentType: { font: "新細明體", size: 19 },
      deliveryNo: { font: "Meiryo", size: 11.2 },
      tripNo: { font: "Meiryo", size: 12 },
      customerLocation: { font: "新細明體", size: 14 },
      customerLocationBrackets: { font: "Meiryo", size: 14 },
      dispatcher: { font: "新細明體（本文）", size: 14 },
      vehicleNo: { font: "Meiryo", size: 12.5 },
      driver: { font: "Meiryo", size: 14 },
      departureTime: { font: "Meiryo", size: 14 },
      rightValues: { font: "Meiryo", size: 13 },
      product: { font: "新細明體", size: 14 },
      productDigits: { font: "Meiryo", size: 14 },
    },
    printArea: "A2:AQ22",
  },
};
