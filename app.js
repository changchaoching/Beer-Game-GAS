/**
 * Beer Distribution Game - Frontend Controller (app.js)
 * 協同 engine.js 與 Chart.js 處理即時互動、圖表渲染、角色切換、手繪心智模型畫布與 Google 試算表同步
 */

document.addEventListener("DOMContentLoaded", function () {
  // 1. 初始化系統動力學模擬引擎 (36 週)
  const engine = new BeerGameEngine({
    totalWeeks: 36
  });

  // 2. DOM 元素快取
  const dom = {
    // 頂部狀態列
    currentWeekBadge: document.getElementById("currentWeekBadge"),
    gameStatusBadge: document.getElementById("gameStatusBadge"),
    resetBtn: document.getElementById("resetBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    openSubmitModalBtn: document.getElementById("openSubmitModalBtn"),
    openCausalModalBtn: document.getElementById("openCausalModalBtn"),
    openSketchModalBtn: document.getElementById("openSketchModalBtn"),

    // 角色選擇與模式
    roleSelect: document.getElementById("roleSelect"),
    aiPolicySelect: document.getElementById("aiPolicySelect"),

    // KPI 卡片
    kpiTotalCost: document.getElementById("kpiTotalCost"),
    kpiCustomerDemand: document.getElementById("kpiCustomerDemand"),
    kpiMyInventory: document.getElementById("kpiMyInventory"),
    kpiMyBacklog: document.getElementById("kpiMyBacklog"),
    kpiBullwhipRatio: document.getElementById("kpiBullwhipRatio"),

    // 節點卡片 (4-Tier Supply Chain Cards)
    cardRetailerInv: document.getElementById("cardRetailerInv"),
    cardRetailerOrder: document.getElementById("cardRetailerOrder"),
    cardRetailerCost: document.getElementById("cardRetailerCost"),

    cardWholesalerInv: document.getElementById("cardWholesalerInv"),
    cardWholesalerOrder: document.getElementById("cardWholesalerOrder"),
    cardWholesalerCost: document.getElementById("cardWholesalerCost"),

    cardDistributorInv: document.getElementById("cardDistributorInv"),
    cardDistributorOrder: document.getElementById("cardDistributorOrder"),
    cardDistributorCost: document.getElementById("cardDistributorCost"),

    cardFactoryInv: document.getElementById("cardFactoryInv"),
    cardFactoryOrder: document.getElementById("cardFactoryOrder"),
    cardFactoryCost: document.getElementById("cardFactoryCost"),

    // 決策輸入面板
    decisionRoleTitle: document.getElementById("decisionRoleTitle"),
    orderInputLabel: document.getElementById("orderInputLabel"),
    sliderOrder: document.getElementById("sliderOrder"),
    valOrder: document.getElementById("valOrder"),
    incomingShipmentVal: document.getElementById("incomingShipmentVal"),
    incomingOrderVal: document.getElementById("incomingOrderVal"),
    pipelineOrdersVal: document.getElementById("pipelineOrdersVal"),
    pipelineShipmentsVal: document.getElementById("pipelineShipmentsVal"),

    // 多角色全控輸入容器 (當選擇全控模式時顯示)
    multiControlBox: document.getElementById("multiControlBox"),
    inputOrderRetailer: document.getElementById("inputOrderRetailer"),
    inputOrderWholesaler: document.getElementById("inputOrderWholesaler"),
    inputOrderDistributor: document.getElementById("inputOrderDistributor"),
    inputOrderFactory: document.getElementById("inputOrderFactory"),

    // 推進按鈕
    stepOneWeekBtn: document.getElementById("stepOneWeekBtn"),
    stepFourWeeksBtn: document.getElementById("stepFourWeeksBtn"),

    // 典型策略預設按鈕
    presetEquilibrium: document.getElementById("presetEquilibrium"),
    presetPanicHoard: document.getElementById("presetPanicHoard"),
    presetRational: document.getElementById("presetRational"),

    // 歷史營運記錄表格
    logTableBody: document.getElementById("logTableBody"),

    // 模態視窗 1: 因果迴路解析
    causalModal: document.getElementById("causalModal"),
    closeCausalModalBtn: document.getElementById("closeCausalModalBtn"),

    // 模態視窗 2: 手繪心智模型 (Post-game sketch)
    sketchModal: document.getElementById("sketchModal"),
    closeSketchModalBtn: document.getElementById("closeSketchModalBtn"),
    sketchCanvas: document.getElementById("sketchCanvas"),
    clearSketchBtn: document.getElementById("clearSketchBtn"),
    revealTrueDemandBtn: document.getElementById("revealTrueDemandBtn"),
    sketchDebriefText: document.getElementById("sketchDebriefText"),

    // 模態視窗 3: 成績提交至 Google 試算表
    submitModal: document.getElementById("submitModal"),
    closeSubmitModalBtn: document.getElementById("closeSubmitModalBtn"),
    cancelSubmitBtn: document.getElementById("cancelSubmitBtn"),
    submitForm: document.getElementById("submitForm"),
    submitBtn: document.getElementById("submitBtn"),
    submitStatusMsg: document.getElementById("submitStatusMsg"),
    inputGasUrl: document.getElementById("inputGasUrl"),
    inputClassName: document.getElementById("inputClassName"),
    inputStudentId: document.getElementById("inputStudentId"),
    inputStudentName: document.getElementById("inputStudentName"),
    inputReportUrl: document.getElementById("inputReportUrl")
  };

  // 從 LocalStorage 載入上次填寫的 Google Webhook URL
  const savedGasUrl = localStorage.getItem("beer_game_gas_url");
  if (savedGasUrl && dom.inputGasUrl) {
    dom.inputGasUrl.value = savedGasUrl;
  }

  // 3. Chart.js 圖表實例
  let chartOrders = null;
  let chartInventory = null;
  let chartCosts = null;

  function initCharts() {
    const ctxOrders = document.getElementById("chartOrders").getContext("2d");
    const ctxInventory = document.getElementById("chartInventory").getContext("2d");
    const ctxCosts = document.getElementById("chartCosts").getContext("2d");

    // 圖表 1: 四節點訂單波動與長鞭效應 (Orders vs. Customer Demand)
    chartOrders = new Chart(ctxOrders, {
      type: "line",
      data: {
        labels: [1],
        datasets: [
          {
            label: "顧客真實需求 (Customer)",
            data: [4],
            borderColor: "#1e293b", // slate-800
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0
          },
          {
            label: "零售商訂單 (Retailer)",
            data: [4],
            borderColor: "#3b82f6", // blue-500
            fill: false,
            tension: 0.1
          },
          {
            label: "批發商訂單 (Wholesaler)",
            data: [4],
            borderColor: "#10b981", // emerald-500
            fill: false,
            tension: 0.1
          },
          {
            label: "經銷商訂單 (Distributor)",
            data: [4],
            borderColor: "#f59e0b", // amber-500
            fill: false,
            tension: 0.1
          },
          {
            label: "工廠排產 (Factory)",
            data: [4],
            borderColor: "#ef4444", // red-500
            borderWidth: 2.5,
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { mode: "index", intersect: false }
        },
        scales: {
          x: { title: { display: true, text: "週次 (Week)" } },
          y: { title: { display: true, text: "訂單數量 (箱 / Cases)" }, min: 0 }
        }
      }
    });

    // 圖表 2: 四節點淨庫存與欠貨震盪 (Effective Inventory = Stock - Backlog)
    chartInventory = new Chart(ctxInventory, {
      type: "line",
      data: {
        labels: [1],
        datasets: [
          {
            label: "零售商淨庫存",
            data: [12],
            borderColor: "#3b82f6",
            fill: false,
            tension: 0.1
          },
          {
            label: "批發商淨庫存",
            data: [12],
            borderColor: "#10b981",
            fill: false,
            tension: 0.1
          },
          {
            label: "經銷商淨庫存",
            data: [12],
            borderColor: "#f59e0b",
            fill: false,
            tension: 0.1
          },
          {
            label: "工廠淨庫存",
            data: [12],
            borderColor: "#ef4444",
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { mode: "index", intersect: false }
        },
        scales: {
          x: { title: { display: true, text: "週次 (Week)" } },
          y: {
            title: { display: true, text: "淨庫存量 (負數為欠貨 Backlog)" },
            grid: {
              color: (context) => (context.tick.value === 0 ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.05)")
            }
          }
        }
      }
    });

    // 圖表 3: 累計成本軌跡 (Cumulative Cost per Stage & Total)
    chartCosts = new Chart(ctxCosts, {
      type: "line",
      data: {
        labels: [1],
        datasets: [
          {
            label: "全鏈總成本 (Total Chain)",
            data: [24],
            borderColor: "#78350f", // 琥珀深褐
            backgroundColor: "rgba(120, 53, 15, 0.1)",
            fill: true,
            borderWidth: 2,
            tension: 0.1
          },
          {
            label: "零售商成本",
            data: [6],
            borderColor: "#3b82f6",
            fill: false,
            tension: 0.1
          },
          {
            label: "批發商成本",
            data: [6],
            borderColor: "#10b981",
            fill: false,
            tension: 0.1
          },
          {
            label: "經銷商成本",
            data: [6],
            borderColor: "#f59e0b",
            fill: false,
            tension: 0.1
          },
          {
            label: "工廠成本",
            data: [6],
            borderColor: "#ef4444",
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: $${context.raw.toFixed(1)}`
            }
          }
        },
        scales: {
          x: { title: { display: true, text: "週次 (Week)" } },
          y: { title: { display: true, text: "累計成本 ($ USD)" }, min: 0 }
        }
      }
    });
  }

  // 4. 更新圖表數據
  function updateCharts(history) {
    const labels = history.map(h => `W${h.week}`);

    // 圖 1 訂單
    chartOrders.data.labels = labels;
    chartOrders.data.datasets[0].data = history.map(h => h.customerDemand);
    chartOrders.data.datasets[1].data = history.map(h => h.retailer.orderPlaced);
    chartOrders.data.datasets[2].data = history.map(h => h.wholesaler.orderPlaced);
    chartOrders.data.datasets[3].data = history.map(h => h.distributor.orderPlaced);
    chartOrders.data.datasets[4].data = history.map(h => h.factory.orderPlaced);
    chartOrders.update();

    // 圖 2 淨庫存
    chartInventory.data.labels = labels;
    chartInventory.data.datasets[0].data = history.map(h => h.retailer.effectiveInventory);
    chartInventory.data.datasets[1].data = history.map(h => h.wholesaler.effectiveInventory);
    chartInventory.data.datasets[2].data = history.map(h => h.distributor.effectiveInventory);
    chartInventory.data.datasets[3].data = history.map(h => h.factory.effectiveInventory);
    chartInventory.update();

    // 圖 3 成本
    chartCosts.data.labels = labels;
    chartCosts.data.datasets[0].data = history.map(h => h.totalChainCost);
    chartCosts.data.datasets[1].data = history.map(h => h.retailer.cumulativeCost);
    chartCosts.data.datasets[2].data = history.map(h => h.wholesaler.cumulativeCost);
    chartCosts.data.datasets[3].data = history.map(h => h.distributor.cumulativeCost);
    chartCosts.data.datasets[4].data = history.map(h => h.factory.cumulativeCost);
    chartCosts.update();
  }

  // 5. 更新 UI 儀表板
  function updateUI() {
    const status = engine.getCurrentStatus();
    const currentRoleKey = dom.roleSelect.value;

    // 狀態標籤
    dom.currentWeekBadge.textContent = `第 ${status.currentWeek} / ${status.totalWeeks} 週`;
    if (status.gameOver) {
      dom.gameStatusBadge.textContent = "模擬已結束";
      dom.gameStatusBadge.className = "px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800";
      dom.stepOneWeekBtn.disabled = true;
      dom.stepFourWeeksBtn.disabled = true;
      dom.openSketchModalBtn.classList.remove("hidden"); // 結案時亮出心智模型繪圖按鈕
    } else {
      dom.gameStatusBadge.textContent = "運作中 (In Progress)";
      dom.gameStatusBadge.className = "px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800";
      dom.stepOneWeekBtn.disabled = false;
      dom.stepFourWeeksBtn.disabled = false;
    }

    // 計算長鞭比率 (工廠最高訂單 / 顧客需求增幅 4 箱)
    let maxFactoryOrder = 4;
    status.history.forEach(h => {
      if (h.factory.orderPlaced > maxFactoryOrder) maxFactoryOrder = h.factory.orderPlaced;
    });
    const bullwhipRatio = (maxFactoryOrder / 4).toFixed(1);

    // KPI 頂部
    dom.kpiTotalCost.textContent = `$${status.totalChainCost.toLocaleString()}`;
    dom.kpiCustomerDemand.textContent = `${status.customerDemand} 箱/週`;
    dom.kpiBullwhipRatio.textContent = `${bullwhipRatio} x`;

    // 當前玩家專屬角色 KPI
    let myRoleObj = status.roles.retailer;
    if (currentRoleKey === 'wholesaler') myRoleObj = status.roles.wholesaler;
    if (currentRoleKey === 'distributor') myRoleObj = status.roles.distributor;
    if (currentRoleKey === 'factory') myRoleObj = status.roles.factory;

    dom.kpiMyInventory.textContent = `${myRoleObj.inventory} 箱`;
    dom.kpiMyBacklog.textContent = `${myRoleObj.backlog} 箱`;
    if (myRoleObj.backlog > 0) {
      dom.kpiMyBacklog.className = "text-xl font-bold text-rose-600 animate-pulse";
    } else {
      dom.kpiMyBacklog.className = "text-xl font-bold text-slate-700";
    }

    // 4 節點卡片資訊
    const r = status.roles.retailer;
    const w = status.roles.wholesaler;
    const d = status.roles.distributor;
    const f = status.roles.factory;

    dom.cardRetailerInv.textContent = `庫存 ${r.inventory} / 欠貨 ${r.backlog}`;
    dom.cardRetailerOrder.textContent = `上期下單: ${r.orderPlaced} 箱`;
    dom.cardRetailerCost.textContent = `$${r.cumulativeCost.toFixed(1)}`;

    dom.cardWholesalerInv.textContent = `庫存 ${w.inventory} / 欠貨 ${w.backlog}`;
    dom.cardWholesalerOrder.textContent = `上期下單: ${w.orderPlaced} 箱`;
    dom.cardWholesalerCost.textContent = `$${w.cumulativeCost.toFixed(1)}`;

    dom.cardDistributorInv.textContent = `庫存 ${d.inventory} / 欠貨 ${d.backlog}`;
    dom.cardDistributorOrder.textContent = `上期下單: ${d.orderPlaced} 箱`;
    dom.cardDistributorCost.textContent = `$${d.cumulativeCost.toFixed(1)}`;

    dom.cardFactoryInv.textContent = `庫存 ${f.inventory} / 欠貨 ${f.backlog}`;
    dom.cardFactoryOrder.textContent = `上期排產: ${f.orderPlaced} 箱`;
    dom.cardFactoryCost.textContent = `$${f.cumulativeCost.toFixed(1)}`;

    // 決策控制面板標題與數值反映
    updateDecisionPanel(myRoleObj, currentRoleKey);

    // 更新圖表
    updateCharts(status.history);

    // 更新表格日誌
    renderLogTable(status.history);

    // 結束時自動彈出通知
    if (status.gameOver && !dom.hasAlertedGameOver) {
      dom.hasAlertedGameOver = true;
      setTimeout(() => {
        alert(status.gameOverReason + "\n\n請點擊上方「手繪顧客需求曲線（心智模型揭秘）」進行體驗，並將成績登錄至 Google 試算表！");
      }, 400);
    }
  }

  function updateDecisionPanel(myRoleObj, roleKey) {
    const roleNames = {
      retailer: "零售商 (Retailer)",
      wholesaler: "批發商 (Wholesaler)",
      distributor: "經銷商 (Distributor)",
      factory: "釀造工廠 (Factory)",
      all: "四節點全控模式 (God Mode)"
    };

    dom.decisionRoleTitle.textContent = roleNames[roleKey] || "零售商";

    if (roleKey === 'all') {
      dom.multiControlBox.classList.remove("hidden");
      dom.sliderOrder.parentElement.classList.add("hidden");
    } else {
      dom.multiControlBox.classList.add("hidden");
      dom.sliderOrder.parentElement.classList.remove("hidden");
      dom.orderInputLabel.textContent = roleKey === 'factory' ? "本週釀造排產決策 (Cases)" : "本週向上游訂購量 (Cases)";
      dom.incomingShipmentVal.textContent = `${myRoleObj.incomingShipment} 箱`;
      dom.incomingOrderVal.textContent = `${myRoleObj.incomingOrder} 箱`;
      dom.pipelineOrdersVal.textContent = `${myRoleObj.pipelineOrders.join(', ')} 箱`;
      dom.pipelineShipmentsVal.textContent = `${myRoleObj.pipelineShipments.join(', ')} 箱`;
    }
  }

  // 6. 渲染歷史明細表格
  function renderLogTable(history) {
    dom.logTableBody.innerHTML = "";
    const reversed = [...history].reverse();
    reversed.forEach(h => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-slate-100 hover:bg-slate-50 text-xs";
      tr.innerHTML = `
        <td class="py-2 px-3 font-semibold text-slate-700">W${h.week}</td>
        <td class="py-2 px-3 font-bold text-slate-900">${h.customerDemand}</td>
        <td class="py-2 px-3 text-blue-600 font-medium">${h.retailer.orderPlaced} (淨:${h.retailer.effectiveInventory})</td>
        <td class="py-2 px-3 text-emerald-600 font-medium">${h.wholesaler.orderPlaced} (淨:${h.wholesaler.effectiveInventory})</td>
        <td class="py-2 px-3 text-amber-600 font-medium">${h.distributor.orderPlaced} (淨:${h.distributor.effectiveInventory})</td>
        <td class="py-2 px-3 text-rose-600 font-bold">${h.factory.orderPlaced} (淨:${h.factory.effectiveInventory})</td>
        <td class="py-2 px-3 font-semibold text-slate-800">$${h.totalChainCost.toFixed(1)}</td>
      `;
      dom.logTableBody.appendChild(tr);
    });
  }

  // 7. 控制面板互動事件
  dom.roleSelect.addEventListener("change", () => {
    updateUI();
  });

  dom.sliderOrder.addEventListener("input", (e) => {
    dom.valOrder.textContent = `${e.target.value} 箱`;
  });

  // 單步推進 (1 週)
  dom.stepOneWeekBtn.addEventListener("click", () => {
    const roleKey = dom.roleSelect.value;
    const aiPolicy = dom.aiPolicySelect.value;

    if (roleKey === 'all') {
      engine.step({
        playerRole: 'all',
        aiPolicy,
        roleOrders: {
          retailer: Number(dom.inputOrderRetailer.value) || 4,
          wholesaler: Number(dom.inputOrderWholesaler.value) || 4,
          distributor: Number(dom.inputOrderDistributor.value) || 4,
          factory: Number(dom.inputOrderFactory.value) || 4
        }
      });
    } else {
      engine.step({
        playerRole: roleKey,
        orderAmount: Number(dom.sliderOrder.value),
        aiPolicy
      });
    }
    updateUI();
  });

  // 批次推進 (4 週)
  dom.stepFourWeeksBtn.addEventListener("click", () => {
    const roleKey = dom.roleSelect.value;
    const aiPolicy = dom.aiPolicySelect.value;

    for (let i = 0; i < 4; i++) {
      if (engine.gameOver) break;
      if (roleKey === 'all') {
        engine.step({
          playerRole: 'all',
          aiPolicy,
          roleOrders: {
            retailer: Number(dom.inputOrderRetailer.value) || 4,
            wholesaler: Number(dom.inputOrderWholesaler.value) || 4,
            distributor: Number(dom.inputOrderDistributor.value) || 4,
            factory: Number(dom.inputOrderFactory.value) || 4
          }
        });
      } else {
        engine.step({
          playerRole: roleKey,
          orderAmount: Number(dom.sliderOrder.value),
          aiPolicy
        });
      }
    }
    updateUI();
  });

  // 重設遊戲
  dom.resetBtn.addEventListener("click", () => {
    if (confirm("確定要重設啤酒遊戲嗎？所有數據將回歸第 1 週初始狀態。")) {
      engine.reset();
      dom.hasAlertedGameOver = false;
      dom.sliderOrder.value = 4;
      dom.valOrder.textContent = "4 箱";
      if (dom.inputOrderRetailer) {
        dom.inputOrderRetailer.value = 4;
        dom.inputOrderWholesaler.value = 4;
        dom.inputOrderDistributor.value = 4;
        dom.inputOrderFactory.value = 4;
      }
      updateUI();
    }
  });

  // 典型策略快速套用
  dom.presetEquilibrium.addEventListener("click", () => {
    dom.sliderOrder.value = 4;
    dom.valOrder.textContent = "4 箱";
  });
  dom.presetPanicHoard.addEventListener("click", () => {
    dom.sliderOrder.value = 24;
    dom.valOrder.textContent = "24 箱";
  });
  dom.presetRational.addEventListener("click", () => {
    dom.sliderOrder.value = 8;
    dom.valOrder.textContent = "8 箱";
  });

  // 8. 模態視窗 1: 因果迴路解析
  dom.openCausalModalBtn.addEventListener("click", () => {
    dom.causalModal.classList.remove("hidden");
  });
  dom.closeCausalModalBtn.addEventListener("click", () => {
    dom.causalModal.classList.add("hidden");
  });

  // 9. 模態視窗 2: 手繪心智模型 (Post-Game Canvas Sketch)
  let canvasCtx = null;
  let isDrawing = false;

  function initCanvas() {
    canvasCtx = dom.sketchCanvas.getContext("2d");
    dom.sketchCanvas.width = dom.sketchCanvas.offsetWidth;
    dom.sketchCanvas.height = dom.sketchCanvas.offsetHeight;
    clearCanvas();

    dom.sketchCanvas.addEventListener("mousedown", (e) => {
      isDrawing = true;
      const rect = dom.sketchCanvas.getBoundingClientRect();
      canvasCtx.beginPath();
      canvasCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    });

    dom.sketchCanvas.addEventListener("mousemove", (e) => {
      if (!isDrawing) return;
      const rect = dom.sketchCanvas.getBoundingClientRect();
      canvasCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      canvasCtx.strokeStyle = "#ef4444";
      canvasCtx.lineWidth = 3;
      canvasCtx.lineCap = "round";
      canvasCtx.stroke();
    });

    window.addEventListener("mouseup", () => {
      isDrawing = false;
    });

    // 觸控支援 (手機/平板)
    dom.sketchCanvas.addEventListener("touchstart", (e) => {
      isDrawing = true;
      const rect = dom.sketchCanvas.getBoundingClientRect();
      const touch = e.touches[0];
      canvasCtx.beginPath();
      canvasCtx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
      e.preventDefault();
    });

    dom.sketchCanvas.addEventListener("touchmove", (e) => {
      if (!isDrawing) return;
      const rect = dom.sketchCanvas.getBoundingClientRect();
      const touch = e.touches[0];
      canvasCtx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
      canvasCtx.strokeStyle = "#ef4444";
      canvasCtx.lineWidth = 3;
      canvasCtx.stroke();
      e.preventDefault();
    });

    dom.sketchCanvas.addEventListener("touchend", () => {
      isDrawing = false;
    });
  }

  function clearCanvas() {
    if (!canvasCtx) return;
    canvasCtx.clearRect(0, 0, dom.sketchCanvas.width, dom.sketchCanvas.height);
    // 繪製座標軸輔助線
    canvasCtx.strokeStyle = "#cbd5e1";
    canvasCtx.lineWidth = 1;
    // X 軸 (底部)
    canvasCtx.beginPath();
    canvasCtx.moveTo(40, dom.sketchCanvas.height - 30);
    canvasCtx.lineTo(dom.sketchCanvas.width - 20, dom.sketchCanvas.height - 30);
    canvasCtx.stroke();
    // Y 軸 (左側)
    canvasCtx.beginPath();
    canvasCtx.moveTo(40, 20);
    canvasCtx.lineTo(40, dom.sketchCanvas.height - 30);
    canvasCtx.stroke();

    canvasCtx.fillStyle = "#64748b";
    canvasCtx.font = "11px sans-serif";
    canvasCtx.fillText("第 1 週", 40, dom.sketchCanvas.height - 12);
    canvasCtx.fillText("第 36 週", dom.sketchCanvas.width - 60, dom.sketchCanvas.height - 12);
    canvasCtx.fillText("訂單量 (高)", 45, 30);
    canvasCtx.fillText("0 箱", 15, dom.sketchCanvas.height - 30);
  }

  dom.openSketchModalBtn.addEventListener("click", () => {
    dom.sketchModal.classList.remove("hidden");
    setTimeout(() => {
      initCanvas();
    }, 100);
  });
  dom.closeSketchModalBtn.addEventListener("click", () => {
    dom.sketchModal.classList.add("hidden");
  });
  dom.clearSketchBtn.addEventListener("click", () => {
    clearCanvas();
    dom.sketchDebriefText.classList.add("hidden");
  });

  dom.revealTrueDemandBtn.addEventListener("click", () => {
    // 在畫布上畫出綠色的「真實顧客需求」
    if (!canvasCtx) return;
    const w = dom.sketchCanvas.width;
    const h = dom.sketchCanvas.height;
    const originX = 40;
    const originY = h - 30;
    const usableW = w - originX - 30;

    // 4 箱高度約在 15% 處，8 箱在 30% 處
    const y4 = originY - 30;
    const y8 = originY - 60;
    const xStep = originX + (usableW * (4 / 36));

    canvasCtx.beginPath();
    canvasCtx.strokeStyle = "#10b981"; // 綠色
    canvasCtx.lineWidth = 4;
    canvasCtx.moveTo(originX, y4);
    canvasCtx.lineTo(xStep, y4);
    canvasCtx.lineTo(xStep, y8);
    canvasCtx.lineTo(w - 20, y8);
    canvasCtx.stroke();

    canvasCtx.fillStyle = "#10b981";
    canvasCtx.font = "bold 12px sans-serif";
    canvasCtx.fillText("真實顧客需求 (第5週微增至8箱後恆定！)", xStep + 10, y8 - 12);

    dom.sketchDebriefText.classList.remove("hidden");
  });

  // 10. 匯出 CSV 日誌
  dom.exportCsvBtn.addEventListener("click", () => {
    const history = engine.history;
    if (!history || history.length === 0) return alert("尚無模擬紀錄可匯出！");

    let csvContent = "\uFEFF週次,顧客需求,零售商訂單,零售商淨庫存,批發商訂單,批發商淨庫存,經銷商訂單,經銷商淨庫存,工廠排產,工廠淨庫存,全鏈總成本\n";
    history.forEach(h => {
      csvContent += `${h.week},${h.customerDemand},${h.retailer.orderPlaced},${h.retailer.effectiveInventory},${h.wholesaler.orderPlaced},${h.wholesaler.effectiveInventory},${h.distributor.orderPlaced},${h.distributor.effectiveInventory},${h.factory.orderPlaced},${h.factory.effectiveInventory},${h.totalChainCost}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Beer_Game_Supply_Chain_Log_W${engine.currentWeek}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // 11. 登錄成績至 Google 試算表 (Two-Sheet Architecture)
  dom.openSubmitModalBtn.addEventListener("click", () => {
    dom.submitModal.classList.remove("hidden");
  });
  dom.closeSubmitModalBtn.addEventListener("click", () => {
    dom.submitModal.classList.add("hidden");
  });
  dom.cancelSubmitBtn.addEventListener("click", () => {
    dom.submitModal.classList.add("hidden");
  });

  dom.submitForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const gasUrl = dom.inputGasUrl.value.trim();
    const className = dom.inputClassName.value.trim();
    const studentId = dom.inputStudentId.value.trim();
    const studentName = dom.inputStudentName.value.trim();
    const reportUrl = dom.inputReportUrl.value.trim();

    if (!gasUrl) {
      alert("請輸入 Google Apps Script 網路應用程式 URL！");
      return;
    }
    if (!studentId || !studentName) {
      alert("請填寫學號與姓名！");
      return;
    }

    localStorage.setItem("beer_game_gas_url", gasUrl);

    dom.submitBtn.disabled = true;
    dom.submitBtn.textContent = "上傳同步中...";
    dom.submitStatusMsg.textContent = "正在將雙工作表資料（供應鏈排行榜與 36 週四節點明細）批次寫入 Google 試算表...";
    dom.submitStatusMsg.className = "text-xs text-amber-600 mt-2 block";

    const status = engine.getCurrentStatus();
    const r = status.roles.retailer;
    const w = status.roles.wholesaler;
    const d = status.roles.distributor;
    const f = status.roles.factory;

    // 計算峰值指標
    let maxChainBacklog = 0;
    let maxChainInventory = 0;
    let maxFactoryOrder = 4;
    status.history.forEach(h => {
      const bSum = h.retailer.backlog + h.wholesaler.backlog + h.distributor.backlog + h.factory.backlog;
      const iSum = h.retailer.inventory + h.wholesaler.inventory + h.distributor.inventory + h.factory.inventory;
      if (bSum > maxChainBacklog) maxChainBacklog = bSum;
      if (iSum > maxChainInventory) maxChainInventory = iSum;
      if (h.factory.orderPlaced > maxFactoryOrder) maxFactoryOrder = h.factory.orderPlaced;
    });

    const payload = {
      summary: {
        className,
        studentId,
        studentName,
        playerRole: dom.roleSelect.options[dom.roleSelect.selectedIndex].text,
        totalChainCost: status.totalChainCost,
        retailerCost: r.cumulativeCost,
        wholesalerCost: w.cumulativeCost,
        distributorCost: d.cumulativeCost,
        factoryCost: f.cumulativeCost,
        maxBacklog: maxChainBacklog,
        maxInventory: maxChainInventory,
        bullwhipRatio: Number((maxFactoryOrder / 4).toFixed(1)),
        simulationWeeks: status.currentWeek,
        gameOverReason: status.gameOverReason || "模擬進行中登錄"
      },
      reportUrl,
      history: status.history
    };

    try {
      await fetch(gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      dom.submitStatusMsg.textContent = "✅ 資料已成功發送至 Google 試算表後端！感謝您的提交。";
      dom.submitStatusMsg.className = "text-xs text-emerald-600 font-semibold mt-2 block";
      setTimeout(() => {
        dom.submitModal.classList.add("hidden");
        dom.submitBtn.disabled = false;
        dom.submitBtn.textContent = "確認送出";
      }, 1500);

    } catch (err) {
      console.error(err);
      dom.submitStatusMsg.textContent = `❌ 上傳發生錯誤: ${err.message}`;
      dom.submitStatusMsg.className = "text-xs text-rose-600 font-semibold mt-2 block";
      dom.submitBtn.disabled = false;
      dom.submitBtn.textContent = "重新送出";
    }
  });

  // 初始化啟動
  initCharts();
  updateUI();
});
