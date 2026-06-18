/* ==========================================================================
   MOZN FraudLens JS Application Engine (State Machine & Simulator Logic)
   ========================================================================== */

// Default Sample Transaction Dataset (30-day simulation bank profile)
const defaultSimulationData = [
    { transaction_id: "TXN2001", amount: 4500, currency: "AED", merchant_category: "Remittance", risk_score: 87, is_fraud: 1, layer: "Transaction", signals: ["dev_fp_mismatch:0.92;vpn_active:1;velocity_1h_high:1"] },
    { transaction_id: "TXN2002", amount: 150, currency: "AED", merchant_category: "Fuel", risk_score: 12, is_fraud: 0, layer: "Device", signals: ["no_anomaly:1"] },
    { transaction_id: "TXN2003", amount: 12000, currency: "SAR", merchant_category: "Gold Souq", risk_score: 92, is_fraud: 1, layer: "Transaction", signals: ["velocity_1h_high:1;multi_cards:1;loc_spoofing:0.89"] },
    { transaction_id: "TXN2004", amount: 300, currency: "SAR", merchant_category: "Fuel", risk_score: 8, is_fraud: 0, layer: "Behavioral", signals: ["no_anomaly:1"] },
    { transaction_id: "TXN2005", amount: 7500, currency: "AED", merchant_category: "Cross-Border", risk_score: 78, is_fraud: 1, layer: "Device", signals: ["dev_fp_mismatch:0.78;loc_spoofing:0.95"] },
    { transaction_id: "TXN2006", amount: 120, currency: "SAR", merchant_category: "Food", risk_score: 15, is_fraud: 0, layer: "Transaction", signals: ["no_anomaly:1"] },
    { transaction_id: "TXN2007", amount: 5500, currency: "AED", merchant_category: "Remittance", risk_score: 65, is_fraud: 0, layer: "Behavioral", signals: ["velocity_1h_high:1;multi_cards:0"] },
    { transaction_id: "TXN2008", amount: 1800, currency: "SAR", merchant_category: "Retail", risk_score: 42, is_fraud: 0, layer: "Behavioral", signals: ["velocity_1h_high:0.6"] },
    { transaction_id: "TXN2009", amount: 15000, currency: "SAR", merchant_category: "Gold Souq", risk_score: 88, is_fraud: 1, layer: "Transaction", signals: ["velocity_1h_high:1;large_amount:1"] },
    { transaction_id: "TXN2010", amount: 9500, currency: "AED", merchant_category: "Cross-Border", risk_score: 82, is_fraud: 1, layer: "Device", signals: ["dev_fp_mismatch:1;loc_spoofing:0.82"] },
    { transaction_id: "TXN2011", amount: 200, currency: "AED", merchant_category: "Fuel", risk_score: 10, is_fraud: 0, layer: "Device", signals: ["no_anomaly:1"] },
    { transaction_id: "TXN2012", amount: 6200, currency: "SAR", merchant_category: "Remittance", risk_score: 71, is_fraud: 1, layer: "Behavioral", signals: ["velocity_1h_high:1;multi_cards:1"] },
    { transaction_id: "TXN2013", amount: 850, currency: "SAR", merchant_category: "Retail", risk_score: 22, is_fraud: 0, layer: "Transaction", signals: ["no_anomaly:1"] },
    { transaction_id: "TXN2014", amount: 11000, currency: "AED", merchant_category: "Gold Souq", risk_score: 95, is_fraud: 1, layer: "Transaction", signals: ["multi_cards:1;large_amount:1"] },
    { transaction_id: "TXN2015", amount: 3500, currency: "AED", merchant_category: "Cross-Border", risk_score: 58, is_fraud: 0, layer: "Device", signals: ["dev_fp_mismatch:0.58"] },
    { transaction_id: "TXN2016", amount: 7200, currency: "SAR", merchant_category: "Cross-Border", risk_score: 69, is_fraud: 0, layer: "Behavioral", signals: ["velocity_1h_high:1;loc_spoofing:0.69"] },
    { transaction_id: "TXN2017", amount: 13000, currency: "AED", merchant_category: "Gold Souq", risk_score: 90, is_fraud: 1, layer: "Transaction", signals: ["large_amount:1"] }
];


// Active State Variables
let currentSimulationDataset = [...defaultSimulationData];
let activeAlertsQueue = [];
let triageHistory = [];
let activeFilter = "all";
let slaTimerInterval = null;
let selectedAlertId = null; // Track currently selected transaction ID for detail pane
let globalFpr = 0; // Track the False Positive Rate globally for compliance checks
let activeSort = "priority"; // Track active queue sorting criteria
let loggedDriftWarning = false; // Prevent duplicate warnings in the compliance terminal


// XAI Plain-Language Translation Engine
const XaiFeatureMap = {
    "dev_fp_mismatch": "Device Fingerprint Mismatch",
    "vpn_active": "VPN Connection Active",
    "velocity_1h_high": "High 1-Hour Velocity",
    "loc_spoofing": "Location Spoofing Detected",
    "multi_cards": "Multiple Card Swipe Attempt",
    "no_anomaly": "No Anomaly",
    "large_amount": "Large Amount Detected"
};

function parseXaiSignals(signals) {
    if (!signals) return [];
    let rawTokens = [];
    if (Array.isArray(signals)) {
        signals.forEach(s => {
            if (s) {
                s.split(';').forEach(token => {
                    if (token.trim()) rawTokens.push(token.trim());
                });
            }
        });
    } else if (typeof signals === 'string') {
        signals.split(';').forEach(token => {
            if (token.trim()) rawTokens.push(token.trim());
        });
    }

    return rawTokens.map(token => {
        const parts = token.split(':');
        const key = parts[0].trim();
        const val = parts[1] ? parts[1].trim() : null;
        const label = XaiFeatureMap[key] || key;
        if (val !== null && val !== undefined && val !== "1" && val !== "0" && val !== "true" && val !== "false") {
            return `🚨 ${label} (Value: ${val})`;
        } else {
            return `🚨 ${label}`;
        }
    });
}

// Multi-Currency Exchange Rate Converter (1 AED = 1.02 SAR, 1 SAR = 0.98 AED)
function getAmountInActiveCurrency(txn) {
    if (txn.currency === activeCurrency) {
        return txn.amount;
    }
    if (activeCurrency === "SAR" && txn.currency === "AED") {
        return txn.amount * 1.02;
    }
    if (activeCurrency === "AED" && txn.currency === "SAR") {
        return txn.amount * 0.98;
    }
    return txn.amount;
}

// Regulatory Compliance Mode Breach Check
function runComplianceChecks() {
    const complianceCheckbox = document.getElementById("compliance-mode-checkbox");
    const justificationArea = document.getElementById("compliance-justification-area");
    const commitBtn = document.getElementById("commit-policy-btn");
    const justificationInput = document.getElementById("compliance-justification-input");
    const charCounter = document.getElementById("justification-char-counter");

    const complianceMode = complianceCheckbox ? complianceCheckbox.checked : false;

    if (!complianceMode) {
        if (justificationArea) justificationArea.classList.add("hidden");
        if (commitBtn) commitBtn.disabled = false;
        return;
    }

    if (globalFpr > 30) {
        if (justificationArea) justificationArea.classList.remove("hidden");
        const val = justificationInput ? justificationInput.value : "";
        const len = val.length;
        if (charCounter) charCounter.textContent = `${len} / 20 characters`;

        if (len >= 20) {
            if (commitBtn) commitBtn.disabled = false;
        } else {
            if (commitBtn) commitBtn.disabled = true;
        }
    } else {
        if (justificationArea) justificationArea.classList.add("hidden");
        if (commitBtn) commitBtn.disabled = false;
    }
}

function setupComplianceListeners() {
    const complianceCheckbox = document.getElementById("compliance-mode-checkbox");
    const justificationInput = document.getElementById("compliance-justification-input");

    if (complianceCheckbox) {
        complianceCheckbox.addEventListener("change", runComplianceChecks);
    }
    if (justificationInput) {
        justificationInput.addEventListener("input", runComplianceChecks);
    }
}

// DOM Elements
const masterSlider = document.getElementById("master-threshold-slider");
const masterSliderVal = document.getElementById("master-slider-val");
const deviceSlider = document.getElementById("device-threshold-slider");
const deviceSliderVal = document.getElementById("device-slider-val");
const behavioralSlider = document.getElementById("behavioral-threshold-slider");
const behavioralSliderVal = document.getElementById("behavioral-slider-val");
const transactionSlider = document.getElementById("transaction-threshold-slider");
const transactionSliderVal = document.getElementById("transaction-slider-val");

const metricTpr = document.getElementById("metric-tpr");
const metricFpr = document.getElementById("metric-fpr");
const metricFraudLoss = document.getElementById("metric-fraud-loss");
const metricDeclineCost = document.getElementById("metric-decline-cost");

const recContent = document.getElementById("recommendation-content");
const guardrailBox = document.getElementById("guardrail-alert-box");
const guardrailContent = document.getElementById("guardrail-alert-content");

const alertList = document.getElementById("alert-list");
const activeAlertCountBadge = document.getElementById("active-alert-count");
const historyList = document.getElementById("triage-history-list");
const historyEmptyState = document.getElementById("history-empty-state");
const auditLogTerminal = document.getElementById("audit-log-terminal");
const clearLogBtn = document.getElementById("clear-audit-log-btn");

const csvInput = document.getElementById("csv-file-input");
const csvLabel = document.getElementById("csv-label");
const csvErrorBanner = document.getElementById("csv-error-message");
const dataSourceIndicator = document.getElementById("data-source-indicator");

// Accordion elements
const accordionTrigger = document.getElementById("accordion-trigger-btn");
const accordionChevron = document.getElementById("accordion-chevron");
const accordionPanel = document.getElementById("accordion-panel");

// Triage Filter Buttons
const filterAllBtn = document.getElementById("filter-all");
const filterDeviceBtn = document.getElementById("filter-device");
const filterBehavioralBtn = document.getElementById("filter-behavioral");
const filterTransactionBtn = document.getElementById("filter-transaction");

let activeCurrency = "SAR";

// Currency conversion formatting helper with pegs
function formatCurrency(amount, currency = activeCurrency, forceConvert = false) {
    let finalAmount = amount;
    let finalCurrency = currency;

    if (forceConvert && currency !== activeCurrency) {
        if (activeCurrency === "SAR" && currency === "AED") {
            finalAmount = amount * 1.02;
        } else if (activeCurrency === "AED" && currency === "SAR") {
            finalAmount = amount * 0.98;
        }
        finalCurrency = activeCurrency;
    }

    return new Intl.NumberFormat('en-US', { style: 'decimal', maximumFractionDigits: 0 }).format(finalAmount) + ` ${finalCurrency}`;
}


// Write to compliance audit log
function writeToAuditLog(eventText, type = "write") {
    if (auditLogTerminal.querySelector(".placeholder")) {
        auditLogTerminal.innerHTML = "";
    }
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const row = document.createElement("div");
    row.className = `terminal-row ${type}-event`;
    row.textContent = `[${timestamp}] ${eventText}`;
    auditLogTerminal.appendChild(row);
    auditLogTerminal.scrollTop = auditLogTerminal.scrollHeight;
}

// Generate active alerts from dataset matching the threshold
function generateAlertsFromDataset() {
    activeAlertsQueue = [];
    const masterCutoff = parseInt(masterSlider.value);
    const deviceCutoff = parseInt(deviceSlider.value);
    const behavioralCutoff = parseInt(behavioralSlider.value);
    const transactionCutoff = parseInt(transactionSlider.value);

    currentSimulationDataset.forEach(txn => {
        // Exclude already triaged items in this session
        const alreadyTriaged = triageHistory.some(hist => hist.transaction_id === txn.transaction_id);
        if (alreadyTriaged) return;

        let shouldFlag = false;
        let triggerReason = "";

        // Flags if the composite score exceeds master OR layer-specific scores exceed limits
        if (txn.risk_score >= masterCutoff) {
            shouldFlag = true;
            triggerReason = "Master Threshold Trigger";
        } else if (txn.layer === "Device" && txn.risk_score >= deviceCutoff) {
            shouldFlag = true;
            triggerReason = `Device Custom Trigger (>=${deviceCutoff})`;
        } else if (txn.layer === "Behavioral" && txn.risk_score >= behavioralCutoff) {
            shouldFlag = true;
            triggerReason = `Behavioral Custom Trigger (>=${behavioralCutoff})`;
        } else if (txn.layer === "Transaction" && txn.risk_score >= transactionCutoff) {
            shouldFlag = true;
            triggerReason = `Transaction Custom Trigger (>=${transactionCutoff})`;
        }

        if (shouldFlag) {
            // Value-based SLA allocation: <1K is 2m (120s), >10K is 10m (600s), else 5m (300s)
            let slaDuration = 300; 
            if (txn.amount < 1000) {
                slaDuration = 120;
            } else if (txn.amount > 10000) {
                slaDuration = 600;
            }

            activeAlertsQueue.push({
                ...txn,
                sla_remaining: slaDuration,
                initial_sla: slaDuration,
                priority: 0,
                trigger_reason: triggerReason
            });
        }
    });

    sortAndRenderQueue();
}

// Sort alert queue by priority: score × urgency
function sortAndRenderQueue() {
    activeAlertsQueue.forEach(alertItem => {
        // Higher score = higher priority
        // Closer to SLA expiration = higher priority multiplier
        const initialSla = alertItem.initial_sla || 300;
        const elapsed = initialSla - alertItem.sla_remaining;
        let urgencyMultiplier = 1 + (elapsed / 100); 

        // If breached, give maximum weight
        if (alertItem.sla_remaining <= 0) {
            urgencyMultiplier = 5;
        }
        alertItem.priority = alertItem.risk_score * urgencyMultiplier;
    });

    // Sort based on active criteria
    if (activeSort === "priority") {
        activeAlertsQueue.sort((a, b) => b.priority - a.priority);
    } else if (activeSort === "score") {
        activeAlertsQueue.sort((a, b) => b.risk_score - a.risk_score);
    } else if (activeSort === "sla") {
        activeAlertsQueue.sort((a, b) => a.sla_remaining - b.sla_remaining);
    } else if (activeSort === "layer") {
        activeAlertsQueue.sort((a, b) => {
            const layerComp = a.layer.localeCompare(b.layer);
            if (layerComp !== 0) return layerComp;
            return b.risk_score - a.risk_score;
        });
    }

    renderQueueHTML();
}

// Handler for queue sorting pill clicks
window.changeQueueSort = function(criteria) {
    activeSort = criteria;

    const buttons = document.querySelectorAll("#queue-sorting-controls .sort-pill-btn");
    buttons.forEach(btn => {
        if (btn.id === `sort-${criteria}`) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    sortAndRenderQueue();
    writeToAuditLog(`Queue sorted by: ${criteria.toUpperCase()}`, "success");
};

// Get SAMA / CBUAE compliant GCC Merchant Context dynamically based on category
function getGccMerchantContext(category, currency) {
    switch(category) {
        case "Gold Souq":
            return {
                title: "GCC Gold Trade Alert Context",
                text: `High-value physical metal acquisition. Subject to SAMA/CBUAE enhanced gold trade reporting rules. Transaction in ${currency}.`
            };
        case "Remittance":
            return {
                title: "GCC Expat Remittance Corridor Control",
                text: "Subject to SAMA AML Circular 384. Verifying identity matching for digital remittance corridor."
            };
        case "Cross-Border":
            return {
                title: "CBUAE Cross-Border Transaction Surveillance",
                text: "Cross-border velocity checks active. Flagged under regional cross-border payment security guidelines."
            };
        case "Fuel":
            return {
                title: "GCC Standard Local Merchant Profile",
                text: "Low-risk local standard retail fuel merchant. Subject to routine cardholder presence verification."
            };
        default:
            return {
                title: "GCC Merchant Risk Control Profile",
                text: `General commercial merchant. Monitored for SAMA compliance and fraud pattern matching in local currency ${currency}.`
            };
    }
}

// Workspace Tab Switching
window.switchTab = function(tabName) {
    const tabTriage = document.getElementById("tab-triage");
    const tabSimulator = document.getElementById("tab-simulator");
    const viewTriage = document.getElementById("view-triage");
    const viewSimulator = document.getElementById("view-simulator");
    
    if (!tabTriage || !tabSimulator || !viewTriage || !viewSimulator) return;

    if (tabName === "triage") {
        tabTriage.classList.add("active");
        tabSimulator.classList.remove("active");
        viewTriage.classList.remove("hidden");
        viewSimulator.classList.add("hidden");
        sortAndRenderQueue();
    } else if (tabName === "simulator") {
        tabTriage.classList.remove("active");
        tabSimulator.classList.add("active");
        viewTriage.classList.add("hidden");
        viewSimulator.classList.remove("hidden");
    }
    
    writeToAuditLog(`Workspace view switched to: ${tabName === 'triage' ? 'Triage Console' : 'Threshold Simulator'}`, "success");
};

// Render Rich Details Pane of selected alert
function renderDetailPane() {
    const detailPane = document.getElementById("triage-detail-pane");
    if (!detailPane) return;

    if (!selectedAlertId) {
        detailPane.innerHTML = `
            <div class="empty-detail-state">
                <div class="empty-icon">🛡️</div>
                <h3 class="empty-title">Queue Triage Console</h3>
                <p class="empty-subtitle">Select a transaction from the queue to begin triage.</p>
            </div>
        `;
        return;
    }

    const alertItem = activeAlertsQueue.find(a => a.transaction_id === selectedAlertId);
    if (!alertItem) {
        selectedAlertId = null;
        renderDetailPane();
        return;
    }

    // Color coding for score gauge
    let scoreClass = "score-low";
    if (alertItem.risk_score >= 80) scoreClass = "score-high";
    else if (alertItem.risk_score >= 60) scoreClass = "score-medium";

    // SLA display
    let slaClass = "sla-normal";
    let slaText = `${Math.floor(alertItem.sla_remaining / 60)}:${String(alertItem.sla_remaining % 60).padStart(2, '0')} remaining`;
    if (alertItem.sla_remaining <= 0) {
        slaClass = "sla-critical";
        slaText = "SLA BREACHED";
    } else if (alertItem.sla_remaining <= 30) {
        slaClass = "sla-critical";
    }

    const formattedAmount = formatCurrency(alertItem.amount, alertItem.currency, true);
    const merchantCtx = getGccMerchantContext(alertItem.merchant_category, alertItem.currency);

    detailPane.innerHTML = `
        <div class="detail-container">
            <!-- Header Section -->
            <div class="detail-header">
                <div class="detail-header-left">
                    <span class="detail-txn-label">Transaction ID</span>
                    <h2 class="detail-txn-id">${alertItem.transaction_id}</h2>
                    <div class="detail-category-pill">
                        <span class="category-dot"></span>
                        <span class="category-name">${alertItem.merchant_category} (${alertItem.currency})</span>
                    </div>
                </div>
                <div class="detail-header-right">
                    <div class="large-score-gauge-container">
                        <div class="large-score-gauge ${scoreClass}">
                            <span class="score-num">${alertItem.risk_score}</span>
                            <span class="score-label">Risk Score</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Scrollable Content Area -->
            <div class="detail-scroll-area">
                <!-- Metadata Grid -->
                <div class="metadata-grid">
                    <div class="metadata-item">
                        <span class="meta-label">Amount</span>
                        <span class="meta-value highlight-amount">${formattedAmount}</span>
                    </div>
                    <div class="metadata-item">
                        <span class="meta-label">Layer Risk</span>
                        <span class="meta-value">
                            <span class="layer-indicator layer-${alertItem.layer.toLowerCase()}">${alertItem.layer} Layer</span>
                        </span>
                    </div>
                    <div class="metadata-item">
                        <span class="meta-label">SLA Urgency</span>
                        <span class="meta-value ${slaClass}">⏱️ ${slaText}</span>
                    </div>
                    <div class="metadata-item">
                        <span class="meta-label">Trigger Reason</span>
                        <span class="meta-value trigger-reason-badge">🔍 ${alertItem.trigger_reason || 'Composite Threshold'}</span>
                    </div>
                </div>

                <!-- Contributing Signals -->
                <div class="signals-section">
                    <h3 class="section-title">Contributing Risk Signals</h3>
                    <div class="signals-list">
                        ${parseXaiSignals(alertItem.signals).map(sig => `
                            <div class="signal-badge-card">
                                <span class="signal-icon">🚨</span>
                                <div class="signal-info">
                                    <span class="signal-text">${sig}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- GCC Merchant Context Box -->
                <div class="merchant-context-box">
                    <h3 class="section-title">${merchantCtx.title}</h3>
                    <p class="merchant-context-text">${merchantCtx.text}</p>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="detail-actions">
                <button class="action-btn btn-block large-btn" onclick="triageAlert('${alertItem.transaction_id}', 'Block')">
                    <span class="btn-icon">🚫</span> Block Transaction
                </button>
                <button class="action-btn btn-review large-btn" onclick="triageAlert('${alertItem.transaction_id}', 'Review')">
                    <span class="btn-icon">🔍</span> Send to Review
                </button>
                <button class="action-btn btn-allow large-btn" onclick="triageAlert('${alertItem.transaction_id}', 'Allow')">
                    <span class="btn-icon">✅</span> Allow Transaction
                </button>
            </div>
        </div>
    `;
}

// Render queue alerts based on filters
function renderQueueHTML() {
    // Save scroll position to prevent jumping
    const savedScrollTop = alertList.scrollTop;

    alertList.innerHTML = "";
    
    // Filter queue
    const filteredQueue = activeAlertsQueue.filter(alertItem => {
        if (activeFilter === "all") return true;
        return alertItem.layer.toLowerCase() === activeFilter.toLowerCase();
    });

    activeAlertCountBadge.textContent = `${filteredQueue.length} Alerts`;
    activeAlertCountBadge.className = `badge ${filteredQueue.length > 8 ? 'badge-red' : 'badge-blue'}`;

    if (filteredQueue.length === 0) {
        alertList.innerHTML = `<div class="empty-state-text">No pending alerts. Adjust thresholds or upload CSV to simulate more alerts.</div>`;
        selectedAlertId = null;
        renderDetailPane();
        return;
    }

    // Auto-select first alert if nothing selected or if selection no longer exists in filtered queue
    if (filteredQueue.length > 0) {
        const stillExists = filteredQueue.some(a => a.transaction_id === selectedAlertId);
        if (!stillExists) {
            selectedAlertId = filteredQueue[0].transaction_id;
        }
    }

    filteredQueue.forEach(alertItem => {
        const card = document.createElement("div");
        const isSelected = selectedAlertId === alertItem.transaction_id;
        card.className = `alert-card-compact${isSelected ? ' selected-card' : ''}`;
        card.id = `alert-card-${alertItem.transaction_id}`;
        card.onclick = () => {
            selectedAlertId = alertItem.transaction_id;
            renderQueueHTML(); // Update selected card state and details
        };

        // Color coding for score badge
        let scoreClass = "score-low";
        if (alertItem.risk_score >= 80) scoreClass = "score-high";
        else if (alertItem.risk_score >= 60) scoreClass = "score-medium";

        // SLA display
        let slaClass = "sla-normal";
        let slaText = `${Math.floor(alertItem.sla_remaining / 60)}:${String(alertItem.sla_remaining % 60).padStart(2, '0')}`;
        if (alertItem.sla_remaining <= 0) {
            slaClass = "sla-critical";
            slaText = "BREACHED";
        } else if (alertItem.sla_remaining <= 30) {
            slaClass = "sla-critical";
        }

        const formattedAmount = formatCurrency(alertItem.amount, alertItem.currency, true);

        card.innerHTML = `
            <div class="alert-card-compact-left">
                <span class="compact-txn-id">${alertItem.transaction_id}</span>
                <span class="compact-amount">${formattedAmount} • ${alertItem.merchant_category}</span>
            </div>
            <div class="alert-card-compact-right">
                <span class="compact-sla ${slaClass}">⏱️ ${slaText}</span>
                <div class="score-gauge ${scoreClass}">${alertItem.risk_score}</div>
            </div>
        `;
        alertList.appendChild(card);
    });

    // Restore scroll position
    alertList.scrollTop = savedScrollTop;

    // Render detail pane
    renderDetailPane();
}

// Triage Action logic with auto-advance
window.triageAlert = function(transactionId, decision) {
    const alertIndex = activeAlertsQueue.findIndex(a => a.transaction_id === transactionId);
    if (alertIndex === -1) return;

    // Auto-advance selection logic within filtered queue
    const filteredQueue = activeAlertsQueue.filter(alertItem => {
        if (activeFilter === "all") return true;
        return alertItem.layer.toLowerCase() === activeFilter.toLowerCase();
    });

    let nextAlertId = null;
    const currentIndex = filteredQueue.findIndex(a => a.transaction_id === transactionId);
    if (currentIndex !== -1 && filteredQueue.length > 1) {
        if (currentIndex < filteredQueue.length - 1) {
            nextAlertId = filteredQueue[currentIndex + 1].transaction_id;
        } else {
            nextAlertId = filteredQueue[currentIndex - 1].transaction_id;
        }
    }

    const alertItem = activeAlertsQueue.splice(alertIndex, 1)[0];
    
    // Add to triage history
    triageHistory.unshift({
        ...alertItem,
        triage_decision: decision,
        processed_timestamp: Date.now(),
        undo_remaining: 300 // 5 minutes window
    });

    if (triageHistory.length > 10) {
        triageHistory.pop();
    }

    // Update selected ID
    selectedAlertId = nextAlertId;

    // SQLite / localStorage Mock DB Insert Command output
    const signalsJson = JSON.stringify(alertItem.signals);
    const sqlStatement = `INSERT INTO fraud_audit_log (transaction_id, decision, user_id, timestamp, risk_score, signals) VALUES ('${alertItem.transaction_id}', '${decision}', 'saurabh_ops', datetime('now'), ${alertItem.risk_score}, '${signalsJson}');`;
    
    // Write to browser storage mock
    const auditRecord = {
        id: Date.now(),
        transaction_id: alertItem.transaction_id,
        decision: decision,
        user_id: "saurabh_ops",
        timestamp: new Date().toISOString(),
        risk_score: alertItem.risk_score,
        signals: alertItem.signals
    };
    
    let localLog = JSON.parse(localStorage.getItem("fraud_audit_log") || "[]");
    localLog.push(auditRecord);
    localStorage.setItem("fraud_audit_log", JSON.stringify(localLog));

    writeToAuditLog(`SQL Execute: ${sqlStatement}`, "write");
    writeToAuditLog(`DB Success: Triage saved for ${alertItem.transaction_id} (Decision: ${decision})`, "success");

    sortAndRenderQueue();
    renderHistory();
};

// Undo action
window.undoTriage = function(transactionId) {
    const histIndex = triageHistory.findIndex(h => h.transaction_id === transactionId);
    if (histIndex === -1) return;

    const restoredAlert = triageHistory.splice(histIndex, 1)[0];

    // Restore back to queue
    activeAlertsQueue.push({
        ...restoredAlert,
        sla_remaining: restoredAlert.sla_remaining // Keep remaining SLA
    });

    // Make restored transaction selected
    selectedAlertId = transactionId;

    // Write undo delete SQL mock
    const sqlDelete = `DELETE FROM fraud_audit_log WHERE transaction_id = '${transactionId}';`;
    writeToAuditLog(`SQL Execute: ${sqlDelete} -- Action: UNDO`, "write");
    writeToAuditLog(`DB Success: Restored transaction ${transactionId} back to active triage queue.`, "success");

    // Remove from mock DB localStorage
    let localLog = JSON.parse(localStorage.getItem("fraud_audit_log") || "[]");
    localLog = localLog.filter(log => log.transaction_id !== transactionId);
    localStorage.setItem("fraud_audit_log", JSON.stringify(localLog));

    sortAndRenderQueue();
    renderHistory();
};

// Render Triage History
function renderHistory() {
    historyList.innerHTML = "";
    
    if (triageHistory.length === 0) {
        historyEmptyState.className = "empty-state-text";
        historyList.appendChild(historyEmptyState);
        return;
    }

    historyEmptyState.className = "empty-state-text hidden";

    triageHistory.forEach(histItem => {
        const row = document.createElement("div");
        row.className = "history-row";

        let decClass = "dec-review";
        if (histItem.triage_decision === "Block") decClass = "dec-block";
        else if (histItem.triage_decision === "Allow") decClass = "dec-allow";

        const minutesRemaining = Math.floor(histItem.undo_remaining / 60);
        const secondsRemaining = String(histItem.undo_remaining % 60).padStart(2, '0');
        const timerText = histItem.undo_remaining > 0 ? `⏱️ Undo (${minutesRemaining}:${secondsRemaining})` : "Locked";

        row.innerHTML = `
            <div class="history-info">
                <span class="history-txn">${histItem.transaction_id}</span>
                <span class="history-decision ${decClass}">${histItem.triage_decision}</span>
                <span class="history-timer">${timerText}</span>
            </div>
            ${histItem.undo_remaining > 0 ? `<button class="undo-btn" onclick="undoTriage('${histItem.transaction_id}')">Undo</button>` : `<span class="locked-text">🔒</span>`}
        `;
        historyList.appendChild(row);
    });
}

// Update simulation calculations based on current slider values
function updateSimulationMetrics() {
    const masterCutoff = parseInt(masterSlider.value);
    
    // Sliders label feedback
    masterSliderVal.textContent = masterCutoff;
    deviceSliderVal.textContent = deviceSlider.value;
    behavioralSliderVal.textContent = behavioralSlider.value;
    transactionSliderVal.textContent = transactionSlider.value;

    let totalActualFraud = 0;
    let caughtFraud = 0;
    
    let totalLegitimate = 0;
    let falsePositives = 0;

    let missedFraudValue = 0;
    let falseDeclineValue = 0;

    currentSimulationDataset.forEach(txn => {
        let isFlagged = false;
        
        if (txn.risk_score >= masterCutoff) {
            isFlagged = true;
        } else if (txn.layer === "Device" && txn.risk_score >= parseInt(deviceSlider.value)) {
            isFlagged = true;
        } else if (txn.layer === "Behavioral" && txn.risk_score >= parseInt(behavioralSlider.value)) {
            isFlagged = true;
        } else if (txn.layer === "Transaction" && txn.risk_score >= parseInt(transactionSlider.value)) {
            isFlagged = true;
        }

        const amt = getAmountInActiveCurrency(txn);

        if (txn.is_fraud === 1) {
            totalActualFraud++;
            if (isFlagged) {
                caughtFraud++;
            } else {
                missedFraudValue += amt;
            }
        } else {
            totalLegitimate++;
            if (isFlagged) {
                falsePositives++;
                falseDeclineValue += amt;
            }
        }
    });

    const tpr = totalActualFraud > 0 ? (caughtFraud / totalActualFraud) * 100 : 0;
    const fpr = totalLegitimate > 0 ? (falsePositives / totalLegitimate) * 100 : 0;
    globalFpr = fpr;

    // Projected daily workload (scale up sample to average daily GCC bank size)
    const projectedAlertsPerDay = Math.round((caughtFraud + falsePositives) * 5.4);

    metricTpr.textContent = `${tpr.toFixed(1)}%`;
    metricFpr.textContent = `${fpr.toFixed(1)}%`;
    metricFraudLoss.textContent = formatCurrency(missedFraudValue);
    metricDeclineCost.textContent = formatCurrency(falseDeclineValue);

    // Alert and Warning limits based on CBUAE Consumer Protection guidelines (<30% False Positive Rate)
    if (fpr > 30) {
        guardrailBox.className = "guardrail-alert";
        guardrailContent.innerHTML = `FPR of <strong>${fpr.toFixed(1)}%</strong> violates UAE Consumer Protection / CBUAE guidelines. Minimize friction for genuine users before deploying.`;
    } else {
        guardrailBox.className = "guardrail-alert hidden";
    }

    // Recommendation Engine: mathematically optimal composite score calculation
    let optimalScore = 75;
    let minCost = Infinity;

    for (let s = 10; s <= 95; s += 5) {
        let testMissedFraudVal = 0;
        let testFalsePositiveCount = 0;
        let testFalseDeclineVal = 0;

        currentSimulationDataset.forEach(txn => {
            let isFlagged = txn.risk_score >= s;
            const amt = getAmountInActiveCurrency(txn);
            if (txn.is_fraud === 1) {
                if (!isFlagged) testMissedFraudVal += amt;
            } else {
                if (isFlagged) {
                    testFalsePositiveCount++;
                    testFalseDeclineVal += amt;
                }
            }
        });

        // Financial loss equation: Missed Fraud Cost + (False Decline Cost * 0.1 friction loss) + (Analyst time Cost: 150 of active currency per alert)
        const analystCost = activeCurrency === "SAR" ? 150 : 150 * 0.98;
        const totalCost = testMissedFraudVal + (testFalseDeclineVal * 0.1) + (testFalsePositiveCount * analystCost);
        if (totalCost < minCost) {
            minCost = totalCost;
            optimalScore = s;
        }
    }

    recContent.innerHTML = `Recommended master threshold: <strong>${optimalScore}</strong>. This minimizes combined fraud leakage and false decline friction. Estimated operational workload: <strong>${projectedAlertsPerDay} alerts/day</strong>.`;

    // Execute compliance policy validation checks
    runComplianceChecks();

    // Render tradeoff curve and drift analytics canvases
    const tradeoffCanvas = document.getElementById("tradeoff-curve-canvas");
    if (tradeoffCanvas) {
        drawTradeoffCurve(tradeoffCanvas);
    }
    const driftCanvas = document.getElementById("drift-telemetry-canvas");
    if (driftCanvas) {
        drawDriftTelemetry(driftCanvas, tpr);
    }
}

// Precompute TPR & FPR points for Tradeoff Curve
function getCurveCoordinates(dataset) {
    const pointsCount = 15;
    const points = [];
    for (let i = 0; i < pointsCount; i++) {
        const t = Math.round(95 - (i * (95 - 10) / (pointsCount - 1)));
        
        let totalActualFraud = 0;
        let caughtFraud = 0;
        let totalLegitimate = 0;
        let falsePositives = 0;

        dataset.forEach(txn => {
            const isFlagged = txn.risk_score >= t;
            if (txn.is_fraud === 1) {
                totalActualFraud++;
                if (isFlagged) caughtFraud++;
            } else {
                totalLegitimate++;
                if (isFlagged) falsePositives++;
            }
        });

        const tpr = totalActualFraud > 0 ? (caughtFraud / totalActualFraud) : 0;
        const fpr = totalLegitimate > 0 ? (falsePositives / totalLegitimate) : 0;
        
        points.push({ threshold: t, fpr, tpr });
    }
    return points;
}

// Set up Canvas backing store scaling for Retina screens
function setupCanvasDpr(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth || canvas.getAttribute('width') || 300;
    const displayHeight = canvas.clientHeight || canvas.getAttribute('height') || 150;
    
    if (canvas.width !== Math.round(displayWidth * dpr) || canvas.height !== Math.round(displayHeight * dpr)) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
    }
    
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    return { width: displayWidth, height: displayHeight };
}

// Draw Precision-Recall Tradeoff Frontier Curve
function drawTradeoffCurve(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = setupCanvasDpr(canvas, ctx);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 15, right: 15, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 1. Draw Gridlines & Axes Ticks
    ctx.lineWidth = 1;
    ctx.font = "9px sans-serif";

    // Y-axis gridlines (TPR: 0%, 25%, 50%, 75%, 100%)
    const yTicks = [0, 0.25, 0.5, 0.75, 1];
    yTicks.forEach(tick => {
        const y = padding.top + (1 - tick) * chartHeight;
        
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.setLineDash([2, 2]);
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${Math.round(tick * 100)}%`, padding.left - 6, y);
    });

    // X-axis gridlines (FPR: 0%, 25%, 50%, 75%, 100%)
    const xTicks = [0, 0.25, 0.5, 0.75, 1];
    xTicks.forEach(tick => {
        const x = padding.left + tick * chartWidth;

        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.setLineDash([2, 2]);
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(`${Math.round(tick * 100)}%`, x, padding.top + chartHeight + 6);
    });

    // 2. Draw Axes Lines
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("False Positive Rate (Friction)", padding.left + chartWidth / 2, padding.top + chartHeight + 20);

    ctx.save();
    ctx.translate(10, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Catch Rate (TPR)", 0, 0);
    ctx.restore();

    // 3. Compute Curve Coordinates
    const points = getCurveCoordinates(currentSimulationDataset);
    const canvasPoints = points.map(pt => ({
        threshold: pt.threshold,
        fpr: pt.fpr,
        tpr: pt.tpr,
        x: padding.left + (pt.fpr * chartWidth),
        y: padding.top + ((1 - pt.tpr) * chartHeight)
    }));

    // 4. Draw Bezier Curve
    if (canvasPoints.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(99, 102, 241, 0.85)";
        ctx.lineWidth = 2.5;
        
        ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
        for (let i = 0; i < canvasPoints.length - 1; i++) {
            const xc = (canvasPoints[i].x + canvasPoints[i + 1].x) / 2;
            const yc = (canvasPoints[i].y + canvasPoints[i + 1].y) / 2;
            ctx.quadraticCurveTo(canvasPoints[i].x, canvasPoints[i].y, xc, yc);
        }
        ctx.lineTo(canvasPoints[canvasPoints.length - 1].x, canvasPoints[canvasPoints.length - 1].y);
        ctx.stroke();
    }

    // 5. Draw Optimal Threshold Dot
    let optimalScore = 75;
    let minCost = Infinity;
    for (let s = 10; s <= 95; s += 5) {
        let testMissedFraudVal = 0;
        let testFalsePositiveCount = 0;
        let testFalseDeclineVal = 0;

        currentSimulationDataset.forEach(txn => {
            let isFlagged = txn.risk_score >= s;
            const amt = getAmountInActiveCurrency(txn);
            if (txn.is_fraud === 1) {
                if (!isFlagged) testMissedFraudVal += amt;
            } else {
                if (isFlagged) {
                    testFalsePositiveCount++;
                    testFalseDeclineVal += amt;
                }
            }
        });

        const analystCost = activeCurrency === "SAR" ? 150 : 150 * 0.98;
        const totalCost = testMissedFraudVal + (testFalseDeclineVal * 0.1) + (testFalsePositiveCount * analystCost);
        if (totalCost < minCost) {
            minCost = totalCost;
            optimalScore = s;
        }
    }

    let optTotalActualFraud = 0;
    let optCaughtFraud = 0;
    let optTotalLegitimate = 0;
    let optFalsePositives = 0;

    currentSimulationDataset.forEach(txn => {
        const isFlagged = txn.risk_score >= optimalScore;
        if (txn.is_fraud === 1) {
            optTotalActualFraud++;
            if (isFlagged) optCaughtFraud++;
        } else {
            optTotalLegitimate++;
            if (isFlagged) optFalsePositives++;
        }
    });

    const optTpr = optTotalActualFraud > 0 ? (optCaughtFraud / optTotalActualFraud) : 0;
    const optFpr = optTotalLegitimate > 0 ? (optFalsePositives / optTotalLegitimate) : 0;

    const optX = padding.left + (optFpr * chartWidth);
    const optY = padding.top + ((1 - optTpr) * chartHeight);

    ctx.beginPath();
    ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
    ctx.arc(optX, optY, 10, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#10b981";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.arc(optX, optY, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#10b981";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Optimal", optX + 8, optY - 2);

    // 6. Draw Pulsing Blue Dot (Current Master Threshold)
    const masterCutoff = parseInt(masterSlider.value);
    let curTotalActualFraud = 0;
    let curCaughtFraud = 0;
    let curTotalLegitimate = 0;
    let curFalsePositives = 0;

    currentSimulationDataset.forEach(txn => {
        const isFlagged = txn.risk_score >= masterCutoff;
        if (txn.is_fraud === 1) {
            curTotalActualFraud++;
            if (isFlagged) curCaughtFraud++;
        } else {
            curTotalLegitimate++;
            if (isFlagged) curFalsePositives++;
        }
    });

    const curTpr = curTotalActualFraud > 0 ? (curCaughtFraud / curTotalActualFraud) : 0;
    const curFpr = curTotalLegitimate > 0 ? (curFalsePositives / curTotalLegitimate) : 0;

    const curX = padding.left + (curFpr * chartWidth);
    const curY = padding.top + ((1 - curTpr) * chartHeight);

    ctx.beginPath();
    ctx.fillStyle = "rgba(59, 130, 246, 0.25)";
    ctx.arc(curX, curY, 12, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(59, 130, 246, 0.85)";
    ctx.lineWidth = 2;
    ctx.arc(curX, curY, 7, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(curX, curY, 4, 0, 2 * Math.PI);
    ctx.fill();

    // 7. Draw Hover Tooltip
    if (canvas._hoverPoint) {
        const pt = canvas._hoverPoint;

        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.arc(pt.x, pt.y, 8, 0, 2 * Math.PI);
        ctx.stroke();

        const tooltipText = `Threshold: ${pt.threshold} | Catch: ${Math.round(pt.tpr * 100)}% | FP: ${Math.round(pt.fpr * 100)}%`;
        ctx.font = "10px sans-serif";
        const textWidth = ctx.measureText(tooltipText).width;

        let tooltipX = pt.x - textWidth / 2 - 6;
        let tooltipY = pt.y - 25;

        if (tooltipX < 5) tooltipX = 5;
        if (tooltipX + textWidth + 12 > width) tooltipX = width - textWidth - 12;
        if (tooltipY < 5) tooltipY = pt.y + 15;

        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.strokeStyle = "rgba(99, 102, 241, 0.5)";
        ctx.lineWidth = 1;

        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(tooltipX, tooltipY, textWidth + 12, 18, 4);
        } else {
            ctx.rect(tooltipX, tooltipY, textWidth + 12, 18);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(tooltipText, tooltipX + 6, tooltipY + 9);
    }
}

// Draw 90-Day Drift Timeline & Warn Badge Telemetry
function drawDriftTelemetry(canvas, currentTprVal) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = setupCanvasDpr(canvas, ctx);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 15, right: 15, bottom: 25, left: 35 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const yTicks = [0, 0.5, 0.7, 1];
    ctx.font = "9px sans-serif";
    
    yTicks.forEach(tick => {
        const y = padding.top + (1 - tick) * chartHeight;
        
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.setLineDash([2, 2]);
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${Math.round(tick * 100)}%`, padding.left - 6, y);
    });

    const xTicks = [0, 30, 60, 90];
    xTicks.forEach(tick => {
        const x = padding.left + (tick / 90) * chartWidth;
        
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.setLineDash([2, 2]);
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(`${tick}d`, x, padding.top + chartHeight + 5);
    });

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    // 1. Draw SAMA Compliance Limit (70% dashed red line)
    const y70 = padding.top + (1 - 0.70) * chartHeight;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.moveTo(padding.left, y70);
    ctx.lineTo(padding.left + chartWidth, y70);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
    ctx.textAlign = "left";
    ctx.fillText("SAMA Limit (70%)", padding.left + 5, y70 - 4);

    // 2. Draw Active composite threshold line
    const masterCutoff = parseInt(masterSlider.value);
    const yThresh = padding.top + (1 - (masterCutoff / 100)) * chartHeight;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
    ctx.lineWidth = 1.2;
    ctx.moveTo(padding.left, yThresh);
    ctx.lineTo(padding.left + chartWidth, yThresh);
    ctx.stroke();

    ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
    ctx.fillText(`Active Threshold (${masterCutoff})`, padding.left + chartWidth - 110, yThresh - 4);

    // 3. Compute 90-day Catch Rate (TPR) decay points
    const points = [];
    for (let d = 0; d <= 90; d += 5) {
        const decay = 23 * (d / 90);
        const noise = Math.sin(d / 4.0) * 1.5;
        const val = Math.max(0, Math.min(100, currentTprVal - decay + noise));
        points.push({
            x: padding.left + (d / 90) * chartWidth,
            y: padding.top + (1 - (val / 100)) * chartHeight,
            val: val
        });
    }

    const finalCatchRate = points[points.length - 1].val;
    const isBreached = finalCatchRate < 70;

    // 4. Draw Catch Rate decay curve path
    ctx.beginPath();
    ctx.strokeStyle = isBreached ? "rgba(245, 158, 11, 0.9)" : "rgba(16, 185, 129, 0.9)";
    ctx.lineWidth = 2.5;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();

    // 5. Fill gradient under the curve
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    grad.addColorStop(0, isBreached ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    
    ctx.beginPath();
    ctx.fillStyle = grad;
    ctx.moveTo(points[0].x, padding.top + chartHeight);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
    ctx.closePath();
    ctx.fill();

    // 6. Draw labels & trigger alarms
    const badge = document.getElementById("drift-warning-badge");
    const footerInfo = document.getElementById("drift-savings-roi");

    if (isBreached) {
        if (badge) badge.classList.remove("hidden");
        if (footerInfo) {
            footerInfo.classList.add("warning-drift");
            
            // Calculate savings ROI
            let currentFalsePositiveCount = 0;
            let currentFalseDeclineVal = 0;
            let currentMissedFraudVal = 0;

            currentSimulationDataset.forEach(txn => {
                let isFlagged = false;
                if (txn.risk_score >= masterCutoff) {
                    isFlagged = true;
                } else if (txn.layer === "Device" && txn.risk_score >= parseInt(deviceSlider.value)) {
                    isFlagged = true;
                } else if (txn.layer === "Behavioral" && txn.risk_score >= parseInt(behavioralSlider.value)) {
                    isFlagged = true;
                } else if (txn.layer === "Transaction" && txn.risk_score >= parseInt(transactionSlider.value)) {
                    isFlagged = true;
                }
                
                const amt = getAmountInActiveCurrency(txn);
                if (txn.is_fraud === 1) {
                    if (!isFlagged) currentMissedFraudVal += amt;
                } else {
                    if (isFlagged) {
                        currentFalsePositiveCount++;
                        currentFalseDeclineVal += amt;
                    }
                }
            });

            const analystCost = activeCurrency === "SAR" ? 150 : 150 * 0.98;
            const totalCurrentCost = currentMissedFraudVal + (currentFalseDeclineVal * 0.1) + (currentFalsePositiveCount * analystCost);

            let optimalScoreVal = 75;
            let minCostVal = Infinity;
            for (let s = 10; s <= 95; s += 5) {
                let testMissedFraudVal = 0;
                let testFalsePositiveCount = 0;
                let testFalseDeclineVal = 0;

                currentSimulationDataset.forEach(txn => {
                    let isFlagged = txn.risk_score >= s;
                    const amt = getAmountInActiveCurrency(txn);
                    if (txn.is_fraud === 1) {
                        if (!isFlagged) testMissedFraudVal += amt;
                    } else {
                        if (isFlagged) {
                            testFalsePositiveCount++;
                            testFalseDeclineVal += amt;
                        }
                    }
                });

                const totalCost = testMissedFraudVal + (testFalseDeclineVal * 0.1) + (testFalsePositiveCount * analystCost);
                if (totalCost < minCostVal) {
                    minCostVal = totalCost;
                    optimalScoreVal = s;
                }
            }

            const savings = Math.max(0, totalCurrentCost - minCostVal);
            footerInfo.innerHTML = `⚠️ Model Catch Rate degraded below 70% SAMA limit. Optimal recalibration saves an estimated <strong>${formatCurrency(savings)}</strong> in leakage & friction.`;
        }

        if (!loggedDriftWarning) {
            writeToAuditLog(`[WARNING] System Alert: Model Drift Detected (Catch Rate: ${finalCatchRate.toFixed(1)}% < SAMA 70% threshold). Recalibration suggested.`, "warning");
            loggedDriftWarning = true;
        }
    } else {
        if (badge) badge.classList.add("hidden");
        if (footerInfo) {
            footerInfo.classList.remove("warning-drift");
            footerInfo.innerHTML = `Model Catch Rate stable. No recalibration needed.`;
        }
    }
}

// Set up event listeners for curve interactions
function setupTradeoffCurveInteraction() {
    const canvas = document.getElementById("tradeoff-curve-canvas");
    if (!canvas) return;

    const padding = { top: 15, right: 15, bottom: 30, left: 40 };

    canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const displayWidth = canvas.clientWidth || 280;
        const displayHeight = canvas.clientHeight || 150;
        
        const chartWidth = displayWidth - padding.left - padding.right;
        const chartHeight = displayHeight - padding.top - padding.bottom;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const pts = getCurveCoordinates(currentSimulationDataset).map(pt => ({
            threshold: pt.threshold,
            fpr: pt.fpr,
            tpr: pt.tpr,
            x: padding.left + (pt.fpr * chartWidth),
            y: padding.top + ((1 - pt.tpr) * chartHeight)
        }));

        let closestPt = null;
        let minDistance = Infinity;

        pts.forEach(pt => {
            const dist = Math.sqrt((pt.x - mouseX) ** 2 + (pt.y - mouseY) ** 2);
            if (dist < minDistance) {
                minDistance = dist;
                closestPt = pt;
            }
        });

        if (minDistance < 30) {
            canvas._hoverPoint = closestPt;
            canvas.style.cursor = "pointer";
        } else {
            canvas._hoverPoint = null;
            canvas.style.cursor = "default";
        }
        drawTradeoffCurve(canvas);
    });

    canvas.addEventListener("mouseleave", () => {
        canvas._hoverPoint = null;
        canvas.style.cursor = "default";
        drawTradeoffCurve(canvas);
    });

    canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        const displayWidth = canvas.clientWidth || 280;
        const displayHeight = canvas.clientHeight || 150;
        
        const chartWidth = displayWidth - padding.left - padding.right;
        const chartHeight = displayHeight - padding.top - padding.bottom;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const pts = getCurveCoordinates(currentSimulationDataset).map(pt => ({
            threshold: pt.threshold,
            fpr: pt.fpr,
            tpr: pt.tpr,
            x: padding.left + (pt.fpr * chartWidth),
            y: padding.top + ((1 - pt.tpr) * chartHeight)
        }));

        let closestPt = null;
        let minDistance = Infinity;

        pts.forEach(pt => {
            const dist = Math.sqrt((pt.x - mouseX) ** 2 + (pt.y - mouseY) ** 2);
            if (dist < minDistance) {
                minDistance = dist;
                closestPt = pt;
            }
        });

        if (closestPt && minDistance < 30) {
            const newMasterVal = closestPt.threshold;
            const oldMaster = parseInt(masterSlider.value) || 1;
            const ratio = newMasterVal / oldMaster;

            masterSlider.value = newMasterVal;
            deviceSlider.value = Math.max(10, Math.min(95, Math.round(parseInt(deviceSlider.value) * ratio)));
            behavioralSlider.value = Math.max(10, Math.min(95, Math.round(parseInt(behavioralSlider.value) * ratio)));
            transactionSlider.value = Math.max(10, Math.min(95, Math.round(parseInt(transactionSlider.value) * ratio)));

            loggedDriftWarning = false;
            updateSimulationMetrics();
            generateAlertsFromDataset();

            writeToAuditLog(`Threshold snapped to ${newMasterVal} via Tradeoff Curve calibration.`, "success");
        }
    });
}

// Setup Event Listeners for sliders
function setupSliderListeners() {
    const sliders = [masterSlider, deviceSlider, behavioralSlider, transactionSlider];
    sliders.forEach(slider => {
        slider.addEventListener("input", () => {
            loggedDriftWarning = false; // Reset warn lock to allow alert on slider changes
            updateSimulationMetrics();
            generateAlertsFromDataset();
        });
    });
}

// Accordion Expand/Collapse logic
accordionTrigger.addEventListener("click", () => {
    accordionPanel.classList.toggle("hidden");
    accordionChevron.classList.toggle("rotate");
});

// Queue filter buttons logic
function setupFilterListeners() {
    const filters = [
        { btn: filterAllBtn, val: "all" },
        { btn: filterDeviceBtn, val: "device" },
        { btn: filterBehavioralBtn, val: "behavioral" },
        { btn: filterTransactionBtn, val: "transaction" }
    ];

    filters.forEach(item => {
        item.btn.addEventListener("click", () => {
            filters.forEach(f => f.btn.classList.remove("active"));
            item.btn.classList.add("active");
            activeFilter = item.val;
            renderQueueHTML();
        });
    });
}

// Clear Audit Log
clearLogBtn.addEventListener("click", () => {
    localStorage.removeItem("fraud_audit_log");
    auditLogTerminal.innerHTML = '<div class="terminal-row placeholder">Audit log cleared. Logs will generate on next triage decision.</div>';
});

// CSV parser implementation
csvInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    csvErrorBanner.classList.add("hidden");
    csvLabel.textContent = `File: ${file.name}`;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        parseCSVText(text, file.name);
    };
    reader.onerror = function() {
        showCSVError("Failed to read transaction file.");
    };
    reader.readAsText(file);
});

function showCSVError(message) {
    csvErrorBanner.textContent = `⚠️ Error: ${message}`;
    csvErrorBanner.classList.remove("hidden");
    csvLabel.textContent = "Upload Anonymized Bank CSV...";
    dataSourceIndicator.textContent = "Fallback: Default GCC Profile Dataset";
}

function parseCSVText(csvContent, fileName) {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) {
        showCSVError("CSV file is empty or missing data rows.");
        return;
    }

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    
    // Validate required headers
    const requiredHeaders = ["transaction_id", "amount", "currency", "merchant_category", "risk_score", "is_fraud"];
    const missing = requiredHeaders.filter(req => !headers.includes(req));

    if (missing.length > 0) {
        showCSVError(`Missing required CSV columns: ${missing.join(", ")}`);
        return;
    }

    const parsedData = [];
    
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(",").map(col => col.trim());
        if (row.length !== headers.length) {
            continue; // Skip malformed rows
        }

        const record = {};
        headers.forEach((header, index) => {
            record[header] = row[index];
        });

        // Convert numerical data types & validate robustly (stripping currencies/spaces)
        record.amount = parseFloat(String(record.amount).replace(/[^0-9.]/g, ''));
        record.risk_score = parseInt(String(record.risk_score).replace(/[^0-9]/g, ''));
        record.is_fraud = parseInt(String(record.is_fraud).replace(/[^0-9]/g, ''));

        if (isNaN(record.amount) || isNaN(record.risk_score) || isNaN(record.is_fraud)) {
            showCSVError(`Invalid data format on row ${i + 1}. Make sure amount, risk_score and is_fraud contain numerical values.`);
            return;
        }

        // Add simulated fields for interface
        const layerTypes = ["Device", "Behavioral", "Transaction"];
        const categories = ["Remittance", "Gold Souq", "Fuel", "Cross-Border"];
        
        record.layer = layerTypes[record.risk_score % 3];
        
        if (record.is_fraud === 1) {
            let sigs = [];
            if (record.layer === "Device") {
                sigs.push("dev_fp_mismatch:0.95");
                sigs.push("vpn_active:1");
            } else if (record.layer === "Behavioral") {
                sigs.push("velocity_1h_high:1");
                sigs.push("loc_spoofing:0.85");
            } else {
                sigs.push("multi_cards:1");
                sigs.push("velocity_1h_high:1");
            }
            record.signals = [sigs.join(";")];
        } else {
            record.signals = ["no_anomaly:1"];
        }

        parsedData.push(record);
    }

    // Count currencies in file to determine dynamic active currency
    const currencies = parsedData.map(d => d.currency.toUpperCase());
    const counts = {};
    let dominant = "SAR";
    let maxCount = 0;
    currencies.forEach(c => {
        counts[c] = (counts[c] || 0) + 1;
        if (counts[c] > maxCount) {
            maxCount = counts[c];
            dominant = c;
        }
    });
    activeCurrency = dominant;
    
    // Update currency selector active state visual pills
    const sarBtn = document.getElementById("currency-sar-btn");
    const aedBtn = document.getElementById("currency-aed-btn");
    if (sarBtn && aedBtn) {
        if (dominant === "SAR") {
            sarBtn.classList.add("active");
            aedBtn.classList.remove("active");
        } else {
            aedBtn.classList.add("active");
            sarBtn.classList.remove("active");
        }
    }

    // Success: Update active simulator dataset
    currentSimulationDataset = parsedData;
    dataSourceIndicator.textContent = `Loaded ${parsedData.length} records from ${fileName}`;
    dataSourceIndicator.className = "data-source-status highlight-green";
    
    writeToAuditLog(`File Uploaded: Simulated database swapped with ${fileName} (${parsedData.length} rows)`, "success");

    updateSimulationMetrics();
    generateAlertsFromDataset();
}

// Currency Selector Toggle Handler
window.toggleCurrency = function(curr) {
    activeCurrency = curr;
    
    const sarBtn = document.getElementById("currency-sar-btn");
    const aedBtn = document.getElementById("currency-aed-btn");
    if (curr === "SAR") {
        if (sarBtn) sarBtn.classList.add("active");
        if (aedBtn) aedBtn.classList.remove("active");
    } else {
        if (aedBtn) aedBtn.classList.add("active");
        if (sarBtn) sarBtn.classList.remove("active");
    }
    
    updateSimulationMetrics();
    renderQueueHTML();
    writeToAuditLog(`Currency preference switched to: ${curr}`, "success");
};

// Commit threshold policy & compliance rationale exporter
window.commitThresholdPolicy = function() {
    const masterCutoff = parseInt(masterSlider.value);
    const deviceCutoff = parseInt(deviceSlider.value);
    const behavioralCutoff = parseInt(behavioralSlider.value);
    const transactionCutoff = parseInt(transactionSlider.value);
    
    const complianceCheckbox = document.getElementById("compliance-mode-checkbox");
    const complianceMode = complianceCheckbox ? complianceCheckbox.checked : false;
    const justificationInput = document.getElementById("compliance-justification-input");
    const justification = complianceMode && globalFpr > 30 ? (justificationInput ? justificationInput.value.trim() : "") : "N/A - Within regulatory threshold limit";
    
    const sqlStatement = `INSERT INTO threshold_justifications (operator, threshold, fpr, justification) VALUES ('saurabh_ops', ${masterCutoff}, ${globalFpr.toFixed(2)}, '${justification.replace(/'/g, "''")}');`;
    
    writeToAuditLog(`SQL Execute: ${sqlStatement}`, "write");
    writeToAuditLog(`DB Success: Threshold policy committed successfully.`, "success");
    
    const docId = 'DOC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const timestamp = new Date().toISOString();
    
    const fileContent = `================================================================
MOZN FRAUDLENS - REGULATORY COMPLIANCE RATIONALE DOCUMENT
================================================================
Document ID: ${docId}
Export Timestamp: ${timestamp}
Authorized Operator: saurabh_ops
----------------------------------------------------------------
THRESHOLD CONFIGURATION DETAILS:
- Master Composite Threshold: ${masterCutoff}
- Device Cutoff: ${deviceCutoff}
- Behavioral Cutoff: ${behavioralCutoff}
- Transaction Cutoff: ${transactionCutoff}
----------------------------------------------------------------
SIMULATED OPERATIONAL METRICS:
- True Positive Rate (Catch): ${metricTpr.textContent}
- False Positive Rate: ${metricFpr.textContent}${globalFpr > 30 ? ' (Violates CBUAE 30% Guideline)' : ''}
- Monthly Fraud Loss: ${metricFraudLoss.textContent}
- False Decline Cost (Friction): ${metricDeclineCost.textContent}
----------------------------------------------------------------
REGULATORY DEVIATION JUSTIFICATION:
"${justification}"
================================================================`;

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "MOZN_Compliance_Rationale.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Web Audio breach alarm generator
function triggerBreachAudio() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const playBeep = (time, freq) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(0.12, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(time);
            osc.stop(time + 0.15);
        };
        playBeep(audioCtx.currentTime, 880);
        playBeep(audioCtx.currentTime + 0.18, 880);
    } catch (err) {
        console.warn("Audio Context playback failed or blocked.", err);
    }
}

// Background timers (SLA count downs & Undo logs)
function startIntervalTimers() {
    if (slaTimerInterval) clearInterval(slaTimerInterval);

    slaTimerInterval = setInterval(() => {
        // 1. Tick Queue Alert SLAs
        let queueChanged = false;
        let playAlarm = false;
        activeAlertsQueue.forEach(alertItem => {
            if (alertItem.sla_remaining > 0) {
                alertItem.sla_remaining--;
                if (alertItem.sla_remaining === 0) {
                    queueChanged = true; // Trigger re-sort on SLA breach
                    playAlarm = true;
                }
            }
        });

        if (playAlarm) {
            triggerBreachAudio();
        }

        if (queueChanged) {
            sortAndRenderQueue();
        } else {
            renderQueueHTML();
        }

        // 2. Tick Triage Undo Windows
        let historyChanged = false;
        triageHistory.forEach(histItem => {
            if (histItem.undo_remaining > 0) {
                histItem.undo_remaining--;
                historyChanged = true;
            }
        });

        if (historyChanged) {
            renderHistory();
        }
    }, 1000);
}

// Initialise App
function initApp() {
    setupSliderListeners();
    setupFilterListeners();
    setupComplianceListeners();
    setupTradeoffCurveInteraction();
    updateSimulationMetrics();
    generateAlertsFromDataset();
    startIntervalTimers();
    
    // Add window resize handler to redraw canvases
    window.addEventListener("resize", () => {
        const tradeoffCanvas = document.getElementById("tradeoff-curve-canvas");
        if (tradeoffCanvas) drawTradeoffCurve(tradeoffCanvas);
        
        const driftCanvas = document.getElementById("drift-telemetry-canvas");
        if (driftCanvas) {
            const tprVal = parseFloat(metricTpr.textContent) || 88.0;
            drawDriftTelemetry(driftCanvas, tprVal);
        }
    });
    
    writeToAuditLog("FraudLens Console session initialized.", "success");
    writeToAuditLog("Connected to mock MOZN Transaction Intelligence database.", "success");
}

window.onload = initApp;

// Expose state and functions for automated QA testing
window.__state = {
    get activeAlertsQueue() { return activeAlertsQueue; },
    set activeAlertsQueue(val) { activeAlertsQueue = val; },
    get triageHistory() { return triageHistory; },
    set triageHistory(val) { triageHistory = val; },
    get currentSimulationDataset() { return currentSimulationDataset; },
    set currentSimulationDataset(val) { currentSimulationDataset = val; },
    get globalFpr() { return globalFpr; },
    set globalFpr(val) { globalFpr = val; },
    get activeSort() { return activeSort; },
    set activeSort(val) { activeSort = val; },
    get loggedDriftWarning() { return loggedDriftWarning; },
    set loggedDriftWarning(val) { loggedDriftWarning = val; },
    updateSimulationMetrics,
    generateAlertsFromDataset,
    sortAndRenderQueue,
    renderHistory,
    renderQueueHTML,
    getCurveCoordinates,
    drawTradeoffCurve,
    drawDriftTelemetry
};

