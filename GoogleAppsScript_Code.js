/**
 * =========================================================================
 * Beer Game 啤酒遊戲供應鏈模擬 - 單一試算表、雙工作表 (Two-Sheet Architecture)
 * Google Apps Script 雲端資料庫後端
 * 
 * 依據 MIT Sloan (Jay W. Forrester, John Sterman) 啤酒分配遊戲設計
 * 工作表 1: 啤酒遊戲總成績與供應鏈排行榜 (Leaderboard & Summary)
 * 工作表 2: 每週四節點進度與庫存成本明細 (Weekly Historical Log)
 * =========================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // 等待最多 30 秒鎖定，確保高併發時資料寫入完整性
    lock.waitLock(30000);
    
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "無效的 POST 請求主體 (No POST content)"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. 初始化或獲取雙工作表
    var sheetSummary = getOrCreateSheet(ss, "啤酒遊戲總成績與供應鏈排行榜", getSummaryHeaders(), "#78350f"); // 琥珀麥酒深褐色 Amber Brown
    var sheetDetails = getOrCreateSheet(ss, "每週四節點進度與庫存成本明細", getDetailHeaders(), "#065f46");  // 深翡翠綠 Emerald
    
    var timestamp = new Date();
    var formattedTime = Utilities.formatDate(timestamp, Session.getScriptTimeZone() || "GMT+8", "yyyy-MM-dd HH:mm:ss");
    
    // 2. 寫入 工作表 1: 總成績與排行榜 (單一學生一列)
    var summary = data.summary || {};
    var summaryRow = [
      formattedTime,
      summary.className || "未填寫",
      summary.studentId || "未填寫",
      summary.studentName || "未填寫",
      summary.playerRole || "未指定",
      summary.totalChainCost !== undefined ? summary.totalChainCost : 0,
      summary.retailerCost !== undefined ? summary.retailerCost : 0,
      summary.wholesalerCost !== undefined ? summary.wholesalerCost : 0,
      summary.distributorCost !== undefined ? summary.distributorCost : 0,
      summary.factoryCost !== undefined ? summary.factoryCost : 0,
      summary.maxBacklog !== undefined ? summary.maxBacklog : 0,
      summary.maxInventory !== undefined ? summary.maxInventory : 0,
      summary.bullwhipRatio !== undefined ? summary.bullwhipRatio : 1.0,
      summary.simulationWeeks !== undefined ? summary.simulationWeeks : 36,
      summary.gameOverReason || "正常結束",
      data.reportUrl || ""
    ];
    sheetSummary.appendRow(summaryRow);
    
    // 3. 批量批次寫入 工作表 2: 每週四節點進度明細 (高效 setValues，每位學生寫入 36 筆)
    if (data.history && Array.isArray(data.history) && data.history.length > 0) {
      var rowsToInsert = [];
      for (var i = 0; i < data.history.length; i++) {
        var h = data.history[i];
        var r = h.retailer || {};
        var w = h.wholesaler || {};
        var d = h.distributor || {};
        var f = h.factory || {};

        rowsToInsert.push([
          formattedTime,
          summary.studentId || "未填寫",
          summary.studentName || "未填寫",
          h.week !== undefined ? h.week : (i + 1),
          h.customerDemand !== undefined ? h.customerDemand : 4,
          // 零售商 (Retailer)
          r.orderPlaced !== undefined ? r.orderPlaced : "",
          r.effectiveInventory !== undefined ? r.effectiveInventory : "",
          r.inventory !== undefined ? r.inventory : 0,
          r.backlog !== undefined ? r.backlog : 0,
          r.cumulativeCost !== undefined ? r.cumulativeCost : 0,
          // 批發商 (Wholesaler)
          w.orderPlaced !== undefined ? w.orderPlaced : "",
          w.effectiveInventory !== undefined ? w.effectiveInventory : "",
          w.inventory !== undefined ? w.inventory : 0,
          w.backlog !== undefined ? w.backlog : 0,
          w.cumulativeCost !== undefined ? w.cumulativeCost : 0,
          // 經銷商 (Distributor)
          d.orderPlaced !== undefined ? d.orderPlaced : "",
          d.effectiveInventory !== undefined ? d.effectiveInventory : "",
          d.inventory !== undefined ? d.inventory : 0,
          d.backlog !== undefined ? d.backlog : 0,
          d.cumulativeCost !== undefined ? d.cumulativeCost : 0,
          // 工廠 (Factory)
          f.orderPlaced !== undefined ? f.orderPlaced : "",
          f.effectiveInventory !== undefined ? f.effectiveInventory : "",
          f.inventory !== undefined ? f.inventory : 0,
          f.backlog !== undefined ? f.backlog : 0,
          f.cumulativeCost !== undefined ? f.cumulativeCost : 0,
          // 整鏈總成本
          h.totalChainCost !== undefined ? h.totalChainCost : 0
        ]);
      }
      
      if (rowsToInsert.length > 0) {
        var lastRow = sheetDetails.getLastRow();
        sheetDetails.getRange(lastRow + 1, 1, rowsToInsert.length, rowsToInsert[0].length).setValues(rowsToInsert);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "成功儲存至 Google 試算表！",
      summaryRows: 1,
      detailRows: data.history ? data.history.length : 0
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "寫入 Google 試算表時發生例外錯誤: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    name: "Beer Distribution Game Google Sheets Webhook API",
    version: "2.0",
    architecture: "Two-Sheet Single Spreadsheet",
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 取得或建立格式化工作表
 */
function getOrCreateSheet(ss, sheetName, headers, headerColor) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground(headerColor)
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setFontSize(10)
               .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    
    sheet.setRowHeight(1, 32);
    for (var col = 1; col <= headers.length; col++) {
      sheet.autoResizeColumn(col);
    }
  }
  return sheet;
}

function getSummaryHeaders() {
  return [
    "提交時間",
    "班級",
    "學號",
    "學生姓名",
    "玩家扮演角色",
    "供應鏈總成本 ($)",
    "零售商成本 ($)",
    "批發商成本 ($)",
    "經銷商成本 ($)",
    "工廠成本 ($)",
    "全鏈最高欠貨 (箱)",
    "全鏈最高積壓庫存 (箱)",
    "長鞭放大比率 (Bullwhip Ratio)",
    "模擬週數",
    "結案總結說明",
    "成果報告/心得連結"
  ];
}

function getDetailHeaders() {
  return [
    "提交時間",
    "學號",
    "學生姓名",
    "週次 (Week)",
    "顧客實際需求 (箱)",
    "零售商訂單 (箱)",
    "零售商淨庫存",
    "零售商現有庫存",
    "零售商欠貨量",
    "零售商累計成本 ($)",
    "批發商訂單 (箱)",
    "批發商淨庫存",
    "批發商現有庫存",
    "批發商欠貨量",
    "批發商累計成本 ($)",
    "經銷商訂單 (箱)",
    "經銷商淨庫存",
    "經銷商現有庫存",
    "經銷商欠貨量",
    "經銷商累計成本 ($)",
    "工廠排產訂單 (箱)",
    "工廠淨庫存",
    "工廠現有庫存",
    "工廠欠貨量",
    "工廠累計成本 ($)",
    "整鏈每週累計總成本 ($)"
  ];
}
