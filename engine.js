/**
 * Beer Distribution Game - System Dynamics Simulation Engine (engine.js)
 * 依據 MIT Sloan (Jay W. Forrester, John Sterman) 經典供應鏈系統動力學模型設計
 * 
 * 核心機制：
 * 4 個節點 (Roles):
 * 1. 零售商 (Retailer, R) - 面對最終顧客需求 (Customer Demand)
 * 2. 批發商 (Wholesaler, W) - 面對零售商訂單
 * 3. 經銷商 (Distributor, D) - 面對批發商訂單
 * 4. 工廠/釀酒廠 (Factory, F) - 面對經銷商訂單，並排程自身生產 (Brewing)
 * 
 * 延遲結構 (Delays):
 * - 訂單傳遞延遲 (Information / Order Lead Time): 2 週
 * - 貨物運輸/生產延遲 (Material / Shipping / Production Delay): 2 週
 * 
 * 成本結構 (Cost Accounting):
 * - 庫存持有成本 (Inventory Carrying Cost): $0.50 / 箱 / 週
 * - 缺貨積壓成本 (Backlog Cost): $1.00 / 箱 / 週 (罰款為庫存的兩倍)
 * 
 * 顧客需求模式 (Customer Demand):
 * - 第 1 ~ 4 週: 恆定 4 箱 (平衡穩態 Equilibrium)
 * - 第 5 週起至結束: 階梯上升至 8 箱 (Step change to 8 cases/week)
 */

class BeerGameEngine {
  constructor(config = {}) {
    this.totalWeeks = config.totalWeeks || 36; // 標準測試長度 36 週 (避免第50週期效應 Horizon Effect)
    this.holdingCostPerUnit = 0.50; // $0.50 / 箱 / 週
    this.backlogCostPerUnit = 1.00; // $1.00 / 箱 / 週
    this.initialInventory = 12; // 初始庫存 12 箱
    this.initialDemand = 4; // 初始平衡需求 4 箱
    this.stepDemand = 8; // 第 5 週起階梯需求 8 箱
    this.stepWeek = 5;

    this.reset();
  }

  reset() {
    this.currentWeek = 1;
    this.isCompleted = false;
    this.gameOver = false;
    this.gameOverReason = "";

    // 4 個節點初始化 (Retailer, Wholesaler, Distributor, Factory)
    this.roles = {
      retailer: this.createRoleState("零售商", "Retailer"),
      wholesaler: this.createRoleState("批發商", "Wholesaler"),
      distributor: this.createRoleState("經銷商", "Distributor"),
      factory: this.createRoleState("釀造工廠", "Factory")
    };

    // 歷史紀錄 (用於圖表、日誌與試算表同步)
    this.history = [];

    // 紀錄初始第 1 週開局前平衡狀態 (Week 0 / Week 1 基準)
    this.logInitialState();
  }

  createRoleState(nameZh, nameEn) {
    return {
      nameZh,
      nameEn,
      // 存量 (Stocks)
      inventory: this.initialInventory, // 現有實際庫存 (On-hand Inventory >= 0)
      backlog: 0, // 欠貨積壓 (Cumulative Backlog >= 0)
      effectiveInventory: this.initialInventory, // 淨庫存 = inventory - backlog

      // 管道庫存與延遲隊列 (Pipeline Stocks)
      // 訂單在途隊列 (Mailing delay 2 週): [下週到達, 兩週後到達]
      orderPipeline: [this.initialDemand, this.initialDemand],
      // 貨物在途隊列 (Shipping/Production delay 2 週): [下週到貨, 兩週後到貨]
      shippingPipeline: [this.initialDemand, this.initialDemand],

      // 本週流動量變數 (Flows)
      incomingShipment: this.initialDemand, // 本週收到之貨物
      incomingOrder: this.initialDemand, // 本週收到之下游訂單
      outgoingShipment: this.initialDemand, // 本週出貨給下游之貨物
      orderPlaced: this.initialDemand, // 本週向上游發出之新訂單 (決策變數)

      // 成本累計 (Financials)
      weeklyCost: (this.initialInventory * this.holdingCostPerUnit),
      cumulativeCost: (this.initialInventory * this.holdingCostPerUnit)
    };
  }

  /**
   * 取得指定週數的外部真實顧客訂單 (Customer Demand)
   */
  getCustomerDemand(week) {
    return week >= this.stepWeek ? this.stepDemand : this.initialDemand;
  }

  /**
   * 執行一週的模擬
   * @param {Object} decisions 決策變數
   * @param {number} decisions.playerRole 玩家所控制的角色 ('retailer', 'wholesaler', 'distributor', 'factory', 或 'all')
   * @param {number} decisions.orderAmount 玩家發出的訂單數量 (若為單一角色模式)
   * @param {Object} [decisions.roleOrders] 若為四角色全控模式，各節點的訂單 { retailer, wholesaler, distributor, factory }
   * @param {string} [decisions.aiPolicy] AI 輔助隊友下單策略 ('heuristic', 'naive', 'rational')
   */
  step(decisions) {
    if (this.gameOver) return this.getCurrentStatus();

    const currentCustomerOrder = this.getCustomerDemand(this.currentWeek);

    // 1. 決定 4 個節點本週發出的訂單 (Orders Placed / Production Requests)
    const ordersPlaced = this.resolveOrdersPlaced(decisions, currentCustomerOrder);

    // 2. 依序執行各節點物理流程：
    // Step A: 收到在途貨物 (Receive shipment from shipping pipeline)
    // Step B: 收到下游訂單 (Receive incoming orders from order pipeline)
    // Step C: 履行出貨 (Fulfill backlog + incoming order if stock permits)
    // Step D: 更新庫存、缺貨與成本
    // Step E: 前推進度管道 (Advance shipping & order pipelines)

    const r = this.roles.retailer;
    const w = this.roles.wholesaler;
    const d = this.roles.distributor;
    const f = this.roles.factory;

    // --- A. 接收貨物 (Arriving Shipments) ---
    r.incomingShipment = r.shippingPipeline.shift();
    r.inventory += r.incomingShipment;

    w.incomingShipment = w.shippingPipeline.shift();
    w.inventory += w.incomingShipment;

    d.incomingShipment = d.shippingPipeline.shift();
    d.inventory += d.incomingShipment;

    f.incomingShipment = f.shippingPipeline.shift(); // 工廠產線完工出庫
    f.inventory += f.incomingShipment;

    // --- B. 接收訂單 (Incoming Orders) ---
    // 零售商直接面對顧客
    r.incomingOrder = currentCustomerOrder;
    // 批發商收到零售商經管道延遲的訂單
    w.incomingOrder = w.orderPipeline.shift();
    // 經銷商收到批發商經管道延遲的訂單
    d.incomingOrder = d.orderPipeline.shift();
    // 工廠收到經銷商經管道延遲的訂單
    f.incomingOrder = f.orderPipeline.shift();

    // --- C. 出貨履行與缺貨結算 (Order Fulfillment) ---
    this.fulfillOrder(r, r.incomingOrder);
    this.fulfillOrder(w, w.incomingOrder);
    this.fulfillOrder(d, d.incomingOrder);
    this.fulfillOrder(f, f.incomingOrder);

    // --- D. 訂單發出並送入上游的訂單管道 (Advance Orders to Upstream Pipelines) ---
    r.orderPlaced = Math.max(0, Math.round(Number(ordersPlaced.retailer) || 0));
    w.orderPlaced = Math.max(0, Math.round(Number(ordersPlaced.wholesaler) || 0));
    d.orderPlaced = Math.max(0, Math.round(Number(ordersPlaced.distributor) || 0));
    f.orderPlaced = Math.max(0, Math.round(Number(ordersPlaced.factory) || 0)); // 工廠向產線發出生產排程

    // 訂單進入上游隊列 (2 週延遲)
    w.orderPipeline.push(r.orderPlaced);
    d.orderPipeline.push(w.orderPlaced);
    f.orderPipeline.push(d.orderPlaced);

    // --- E. 出貨送入下游的運輸管道 (Advance Shipments to Downstream Pipelines) ---
    // 工廠出貨給經銷商 (經過 2 週運送延遲)
    d.shippingPipeline.push(f.outgoingShipment);
    // 經銷商出貨給批發商 (經過 2 週運送延遲)
    w.shippingPipeline.push(d.outgoingShipment);
    // 批發商出貨給零售商 (經過 2 週運送延遲)
    r.shippingPipeline.push(w.outgoingShipment);
    // 工廠新排程的啤酒進入 2 週釀造生產延遲管道
    f.shippingPipeline.push(f.orderPlaced);

    // --- F. 成本結算 (Cost Accounting) ---
    this.calculateNodeCost(r);
    this.calculateNodeCost(w);
    this.calculateNodeCost(d);
    this.calculateNodeCost(f);

    // 3. 記錄歷史明細
    this.logCurrentWeek(currentCustomerOrder);

    // 4. 判斷遊戲是否結束
    if (this.currentWeek >= this.totalWeeks) {
      this.isCompleted = true;
      this.gameOver = true;
      const totalChainCost = r.cumulativeCost + w.cumulativeCost + d.cumulativeCost + f.cumulativeCost;
      this.gameOverReason = `🎉 啤酒遊戲模擬結束！第 ${this.totalWeeks} 週供應鏈總營運成本為 $${totalChainCost.toFixed(1)}（零售商: $${r.cumulativeCost.toFixed(1)} / 批發商: $${w.cumulativeCost.toFixed(1)} / 經銷商: $${d.cumulativeCost.toFixed(1)} / 工廠: $${f.cumulativeCost.toFixed(1)}）。`;
    } else {
      this.currentWeek += 1;
    }

    return this.getCurrentStatus();
  }

  fulfillOrder(role, incomingOrder) {
    const totalDemandToFill = incomingOrder + role.backlog;
    if (role.inventory >= totalDemandToFill) {
      role.outgoingShipment = totalDemandToFill;
      role.inventory -= totalDemandToFill;
      role.backlog = 0;
    } else {
      role.outgoingShipment = role.inventory;
      role.backlog = totalDemandToFill - role.inventory;
      role.inventory = 0;
    }
    role.effectiveInventory = role.inventory - role.backlog;
  }

  calculateNodeCost(role) {
    const holdingCost = role.inventory * this.holdingCostPerUnit;
    const backlogCost = role.backlog * this.backlogCostPerUnit;
    role.weeklyCost = holdingCost + backlogCost;
    role.cumulativeCost += role.weeklyCost;
  }

  resolveOrdersPlaced(decisions, customerOrder) {
    const playerRole = decisions.playerRole || 'retailer';
    const roleOrders = decisions.roleOrders || {};
    const aiPolicy = decisions.aiPolicy || 'heuristic'; // 'heuristic' (Sterman 經典行為), 'naive' (上一期需量), 'rational' (最優錨定)

    const orders = {};

    ['retailer', 'wholesaler', 'distributor', 'factory'].forEach(roleKey => {
      if (playerRole === 'all') {
        // 四節點全控模式
        orders[roleKey] = roleOrders[roleKey] !== undefined ? roleOrders[roleKey] : 4;
      } else if (playerRole === roleKey) {
        // 玩家控制的單一角色
        orders[roleKey] = decisions.orderAmount !== undefined ? decisions.orderAmount : 4;
      } else {
        // AI 隊友自動決策
        orders[roleKey] = this.getAiOrder(roleKey, aiPolicy, customerOrder);
      }
    });

    return orders;
  }

  /**
   * AI 隊友下單模型：
   * 依據 Sterman (1989) 經典人類行為決策模型 (Misperceptions of Feedback in Dynamic Decision Making)
   * 決策方程式：
   * Order = ExpectedDemand + AdjustmentForInventory + AdjustmentForSupplyLine
   * 人類最常見的盲點是忽略在途庫存 (Weight on supply line beta ~ 0.1 - 0.2)，在缺貨時恐慌超額下單！
   */
  getAiOrder(roleKey, policy, customerOrder) {
    const node = this.roles[roleKey];
    
    if (policy === 'naive') {
      // 簡單直覺跟隨：收到多少就下多少
      return Math.max(0, node.incomingOrder);
    } else if (policy === 'rational') {
      // 理性供應鏈最優策略：考慮現有庫存與在途庫存總和錨定 (Stock + Pipeline = Target)
      const targetStock = 12;
      const pipelineSum = node.shippingPipeline.reduce((a, b) => a + b, 0);
      const netEffective = (node.inventory - node.backlog) + pipelineSum;
      const discrepancy = targetStock - netEffective;
      return Math.max(0, Math.round(node.incomingOrder + 0.25 * discrepancy));
    }

    // 預設 'heuristic' (Sterman 典型人類行為模型)：
    // 容易忽視在途貨物，急於補足當前欠貨，導致經典長鞭震盪
    const targetInventory = 12;
    const currentStock = node.inventory - node.backlog;
    const stockGap = targetInventory - currentStock;
    // 人類通常只對在途庫存給予 15% 的微小權重 (嚴重低估在途到貨)
    const pipelineSum = node.shippingPipeline.reduce((a, b) => a + b, 0);
    const order = node.incomingOrder + (stockGap * 0.40) - (pipelineSum * 0.08);
    return Math.max(0, Math.round(order));
  }

  logInitialState() {
    this.history.push({
      week: 1,
      customerDemand: this.initialDemand,
      retailer: this.snapRole(this.roles.retailer),
      wholesaler: this.snapRole(this.roles.wholesaler),
      distributor: this.snapRole(this.roles.distributor),
      factory: this.snapRole(this.roles.factory),
      totalChainCost: (this.roles.retailer.cumulativeCost + this.roles.wholesaler.cumulativeCost + this.roles.distributor.cumulativeCost + this.roles.factory.cumulativeCost)
    });
  }

  logCurrentWeek(customerDemand) {
    const totalChainCost = this.roles.retailer.cumulativeCost + this.roles.wholesaler.cumulativeCost + this.roles.distributor.cumulativeCost + this.roles.factory.cumulativeCost;
    this.history.push({
      week: this.currentWeek,
      customerDemand,
      retailer: this.snapRole(this.roles.retailer),
      wholesaler: this.snapRole(this.roles.wholesaler),
      distributor: this.snapRole(this.roles.distributor),
      factory: this.snapRole(this.roles.factory),
      totalChainCost: Number(totalChainCost.toFixed(2))
    });
  }

  snapRole(role) {
    return {
      inventory: role.inventory,
      backlog: role.backlog,
      effectiveInventory: role.effectiveInventory,
      incomingShipment: role.incomingShipment,
      incomingOrder: role.incomingOrder,
      outgoingShipment: role.outgoingShipment,
      orderPlaced: role.orderPlaced,
      pipelineShipments: [...role.shippingPipeline],
      pipelineOrders: [...role.orderPipeline],
      weeklyCost: Number(role.weeklyCost.toFixed(2)),
      cumulativeCost: Number(role.cumulativeCost.toFixed(2))
    };
  }

  getCurrentStatus() {
    const totalChainCost = this.roles.retailer.cumulativeCost + this.roles.wholesaler.cumulativeCost + this.roles.distributor.cumulativeCost + this.roles.factory.cumulativeCost;
    return {
      currentWeek: this.currentWeek,
      totalWeeks: this.totalWeeks,
      isCompleted: this.isCompleted,
      gameOver: this.gameOver,
      gameOverReason: this.gameOverReason,
      customerDemand: this.getCustomerDemand(this.currentWeek),
      roles: {
        retailer: this.snapRole(this.roles.retailer),
        wholesaler: this.snapRole(this.roles.wholesaler),
        distributor: this.snapRole(this.roles.distributor),
        factory: this.snapRole(this.roles.factory)
      },
      totalChainCost: Number(totalChainCost.toFixed(2)),
      history: this.history
    };
  }
}

// 支援瀏覽器與 Node.js 雙環境
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BeerGameEngine;
}
