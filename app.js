/* ==========================================================================
   MOZN FraudLens JS Application Engine (State Machine & Simulator Logic)
   ========================================================================== */

// Default Sample Transaction Dataset (30-day simulation bank profile)
const defaultSimulationData = [
    { transaction_id: "TXN2001", amount: 4500, currency: "AED", merchant_category: "Remittance", risk_score: 87, is_fraud: 1, layer: "Transaction", signals: ["New Device", "VPN Detected", "Large Transfer to High-Risk Account"] },
    { transaction_id: "TXN2002", amount: 150, currency: "AED", merchant_category: "Fuel", risk_score: 12, is_fraud: 0, layer: "Device", signals: ["No Anomaly"] },
    { transaction_id: "TXN2003", amount: 12000, currency: "SAR", merchant_category: "Gold Souq", risk_score: 92, is_fraud: 1, layer: "Transaction", signals: ["Midnight Purchase", "Foreign Card", "Immediate Cash Out"] },
    { transaction_id: "TXN2004", amount: 300, currency: "SAR", merchant_category: "Fuel", risk_score: 8, is_fraud: 0, layer: "Behavioral", signals: ["No Anomaly"] },
    { transaction_id: "TXN2005", amount: 7500, currency: "AED", merchant_category: "Cross-Border", risk_score: 78, is_fraud: 1, layer: "Device", signals: ["Device Fingerprint Mismatch", "IP Location Spoofing"] },
    { transaction_id: "TXN2006", amount: 120, currency: "SAR", merchant_category: "Food", risk_score: 15, is_fraud: 0, layer: "Transaction", signals: ["No Anomaly"] },
    { transaction_id: "TXN2007", amount: 5500, currency: "AED", merchant_category: "Remittance", risk_score: 65, is_fraud: 0, layer: "Behavioral", signals: ["Unusual Remittance Velocity", "First-time Recipient"] },
    { transaction_id: "TXN2008", amount: 1800, currency: "SAR", merchant_category: "Retail", risk_score: 42, is_fraud: 0, layer: "Behavioral", signals: ["Slight Velocity Deviation"] },
    { transaction_id: "TXN2009", amount: 15000, currency: "SAR", merchant_category: "Gold Souq", risk_score: 88, is_fraud: 1, layer: "Transaction", signals: ["High-Value Gold Souq Transfer", "Unusually Large Amount"] },
    { transaction_id: "TXN2010", amount: 9500, currency: "AED", merchant_category: "Cross-Border", risk_score: 82, is_fraud: 1, layer: "Device", signals: ["Dual Device Session", "UAE-KSA Fast Travel Anomaly"] },
    { transaction_id: "TXN2011", amount: 200, currency: "AED", merchant_category: "Fuel", risk_score: 10, is_fraud: 0, layer: "Device", signals: ["No Anomaly"] },
    { transaction_id: "TXN2012", amount: 6200, currency: "SAR", merchant_category: "Remittance", risk_score: 71, is_fraud: 1, layer: "Behavioral", signals: ["Rapid Account Takeover Indicators", "KSA Remittance Threshold Passed"] },
    { transaction_id: "TXN2013", amount: 850, currency: "SAR", merchant_category: "Retail", risk_score: 22, is_fraud: 0, layer: "Transaction", signals: ["Standard Retail spend"] },
    { transaction_id: "TXN2014", amount: 11000, currency: "AED", merchant_category: "Gold Souq", risk_score: 95, is_fraud: 1, layer: "Transaction", signals: ["Multiple Cards Swipe", "Gold Purchase in Dubai"] },
    { transaction_id: "TXN2015", amount: 3500, currency: "AED", merchant_category: "Cross-Border", risk_score: 58, is_fraud: 0, layer: "Device", signals: ["Minor OS Version Mismatch"] },
    { transaction_id: "TXN2016", amount: 7200, currency: "SAR", merchant_category: "Cross-Border", risk_score: 69, is_fraud: 0, layer: "Behavioral", signals: ["Rapid Succession Transfers KSA-UAE"] },
    { transaction_id: "TXN2017", amount: 13000, currency: "AED", merchant_category: "Gold Souq", risk_score: 90, is_fraud: 1, layer: "Transaction", signals: ["Atypical High Value Purchase"] }
];

// Active State Variables
let currentSimulationDataset = [...defaultSimulationData];
let activeAlertsQueue = [];
let triageHistory = [];
let activeFilter = "all";
let slaTimerInterval = null;
let expandedCardId = null;

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

// Currency conversion formatting helper (SAR/AED exchange 1:1 roughly for demo)
function formatCurrency(amount, currency = activeCurrency) {
    return new Intl.NumberFormat('en-US', { style: 'decimal', maximumFractionDigits: 0 }).format(amount) + ` ${currency}`;
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

    // Sort descending by priority
    activeAlertsQueue.sort((a, b) => b.priority - a.priority);

    renderQueueHTML();
}

// Toggle card expand state
window.toggleCardExpand = function(transactionId) {
    if (expandedCardId === transactionId) {
        expandedCardId = null;
    } else {
        expandedCardId = transactionId;
    }
    renderQueueHTML();
};

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
        return;
    }

    filteredQueue.forEach(alertItem => {
        const card = document.createElement("div");
        const isExpanded = expandedCardId === alertItem.transaction_id;
        card.className = `alert-card${isExpanded ? ' expanded active-card' : ''}`;
        card.id = `alert-card-${alertItem.transaction_id}`;
        card.onclick = () => toggleCardExpand(alertItem.transaction_id);

        // Color coding for score gauge
        let scoreClass = "score-low";
        if (alertItem.risk_score >= 80) scoreClass = "score-high";
        else if (alertItem.risk_score >= 60) scoreClass = "score-medium";

        // SLA display
        let slaClass = "sla-normal";
        let slaText = `${Math.floor(alertItem.sla_remaining / 60)}:${String(alertItem.sla_remaining % 60).padStart(2, '0')}`;
        if (alertItem.sla_remaining <= 0) {
            slaClass = "sla-critical";
            slaText = "SLA BREACHED";
        } else if (alertItem.sla_remaining <= 30) {
            slaClass = "sla-critical";
        }

        // GCC Category formatting
        const formattedAmount = formatCurrency(alertItem.amount, alertItem.currency);

        card.innerHTML = `
            <div class="alert-card-top">
                <div class="alert-card-meta">
                    <span class="txn-id">${alertItem.transaction_id}</span>
                    <span class="txn-amount">${formattedAmount} • ${alertItem.merchant_category}</span>
                </div>
                <div class="alert-card-right">
                    <span class="sla-timer ${slaClass}">⏱️ ${slaText}</span>
                    <div class="score-gauge ${scoreClass}">${alertItem.risk_score}</div>
                </div>
            </div>
            
            <div class="alert-card-expandable">
                <div class="alert-card-divider"></div>
                <div class="alert-card-details">
                    <span class="layer-indicator layer-${alertItem.layer.toLowerCase()}">${alertItem.layer} Layer</span>
                    <div class="trigger-reason-text">
                        <span>🔍</span> ${alertItem.trigger_reason || 'Composite Trigger'}
                    </div>
                </div>

                <!-- Signal attributions -->
                <div class="alert-card-tooltip">
                    <div class="tooltip-title">Triggering Signals:</div>
                    ${alertItem.signals.map(sig => `<div class="tooltip-item">${sig}</div>`).join('')}
                </div>

                <div class="alert-card-actions">
                    <button class="action-btn btn-block" onclick="event.stopPropagation(); triageAlert('${alertItem.transaction_id}', 'Block')">Block</button>
                    <button class="action-btn btn-review" onclick="event.stopPropagation(); triageAlert('${alertItem.transaction_id}', 'Review')">Review</button>
                    <button class="action-btn btn-allow" onclick="event.stopPropagation(); triageAlert('${alertItem.transaction_id}', 'Allow')">Allow</button>
                </div>
            </div>
        `;
        alertList.appendChild(card);
    });

    // Restore scroll position
    alertList.scrollTop = savedScrollTop;
}

// Triage Action logic
window.triageAlert = function(transactionId, decision) {
    const alertIndex = activeAlertsQueue.findIndex(a => a.transaction_id === transactionId);
    if (alertIndex === -1) return;

    if (expandedCardId === transactionId) {
        expandedCardId = null;
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

        if (txn.is_fraud === 1) {
            totalActualFraud++;
            if (isFlagged) {
                caughtFraud++;
            } else {
                missedFraudValue += txn.amount;
            }
        } else {
            totalLegitimate++;
            if (isFlagged) {
                falsePositives++;
                falseDeclineValue += txn.amount;
            }
        }
    });

    const tpr = totalActualFraud > 0 ? (caughtFraud / totalActualFraud) * 100 : 0;
    const fpr = totalLegitimate > 0 ? (falsePositives / totalLegitimate) * 100 : 0;

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
            if (txn.is_fraud === 1) {
                if (!isFlagged) testMissedFraudVal += txn.amount;
            } else {
                if (isFlagged) {
                    testFalsePositiveCount++;
                    testFalseDeclineVal += txn.amount;
                }
            }
        });

        // Financial loss equation: Missed Fraud Cost + (False Decline Cost * 0.1 friction loss) + (Analyst time Cost: 150 SAR per alert)
        const totalCost = testMissedFraudVal + (testFalseDeclineVal * 0.1) + (testFalsePositiveCount * 150);
        if (totalCost < minCost) {
            minCost = totalCost;
            optimalScore = s;
        }
    }

    recContent.innerHTML = `Recommended master threshold: <strong>${optimalScore}</strong>. This minimizes combined fraud leakage and false decline friction. Estimated operational workload: <strong>${projectedAlertsPerDay} alerts/day</strong>.`;
}

// Setup Event Listeners for sliders
function setupSliderListeners() {
    const sliders = [masterSlider, deviceSlider, behavioralSlider, transactionSlider];
    sliders.forEach(slider => {
        slider.addEventListener("input", () => {
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
        record.signals = [];

        if (record.is_fraud === 1) {
            record.signals.push("Anomalous Risk Factor Alert");
            if (record.layer === "Device") record.signals.push("Atypical Device Identifier Detected");
            else if (record.layer === "Behavioral") record.signals.push("Velocity Limit Passed");
            else record.signals.push("High Risk Merchant Destination");
        } else {
            record.signals.push("No severe anomalies");
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

    // Success: Update active simulator dataset
    currentSimulationDataset = parsedData;
    dataSourceIndicator.textContent = `Loaded ${parsedData.length} records from ${fileName}`;
    dataSourceIndicator.className = "data-source-status highlight-green";
    
    writeToAuditLog(`File Uploaded: Simulated database swapped with ${fileName} (${parsedData.length} rows)`, "success");

    updateSimulationMetrics();
    generateAlertsFromDataset();
}

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
    updateSimulationMetrics();
    generateAlertsFromDataset();
    startIntervalTimers();
    
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
    updateSimulationMetrics,
    generateAlertsFromDataset,
    sortAndRenderQueue,
    renderHistory,
    renderQueueHTML
};

