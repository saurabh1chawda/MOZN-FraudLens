# USER_GUIDE.md: MOZN FraudLens Operation Guide

This guide describes how to operate the MOZN FraudLens Console prototype interface for both Fraud Analysts (alert triage) and Risk Managers (threshold simulation).

---

## 💻 1. Fraud Analyst: Queue Triage Workflow (Triage Console Tab)

### Tabbed Workspace
*   **Triage Console**: Dedicated workspace for Fraud Analysts. Displays a Master-Detail layout consisting of a left compact alert list and a right detailed inspection pane.
*   **Threshold Simulator**: Dedicated workspace for Risk Managers. Displays full-screen metrics sliders, uploader tools, and compliance guardrails.

### Dynamic Priority List
* Active alerts are visible in the left-hand column.
* Cards sort automatically. The card at the top is the highest priority, determined by:
  $$\text{Priority} = \text{Risk Score} \times \left(1 + \frac{\text{Elapsed Time}}{100}\right)$$
* Let cards sit in the list to observe them re-sorting as they get closer to SLA limits.

### LHS Queue Sorting Controls
* Use the **Sort pills bar** (`Priority`, `Score`, `SLA`, `Layer`) located directly below the quick filters block inside the alert list panel to change the queue ordering criteria:
  * **Priority**: Sorts by dynamic priority index (risk score balanced with timer urgency).
  * **Score**: Sorts queue strictly by raw risk score descending.
  * **SLA**: Sorts queue by remaining SLA countdown timer ascending, moving urgent alerts to the top.
  * **Layer**: Groups alerts alphabetically by layer name (Device, Behavioral, Transaction), sorting by risk score descending within each layer group.
* Sorting preserves the currently active selected card and leaves the Detail pane loaded.

### Processing & Explainable AI (XAI)
* Click on any card in the left list to load its rich details in the right pane.
* Read the **Trigger Badge** (e.g. `Device Custom Trigger (>=70)`) to understand *why* the card was flagged.
* Under the **Contributing Risk Signals** section, observe plain-language explanations translated from raw model features (e.g., `dev_fp_mismatch:0.92;vpn_active:1` is translated to `🚨 Device Fingerprint Mismatch (Value: 0.92)` and `🚨 VPN Connection Active`).
* Check the **GCC Merchant Context** box for localized compliance circular details (e.g. SAMA gold trading circulars, CBUAE remittances, etc.).
* Click one of the action buttons at the bottom of the detail pane:
  * **Block**: Flag transaction as fraudulent.
  * **Review**: Escalate case to senior risk managers.
  * **Allow**: Permit transaction to complete.
* Completing a triage action automatically advances to select the next highest priority alert in the queue.

### Triage Recovery (Undo Actions)
* After clicking a triage button, check the **History & Triage Revision** panel in the bottom-left footer.
* Your action will show a countdown starting at **5:00 minutes**.
* If you made a mistake, click the **Undo** button next to the transaction in the history row before the timer expires. The transaction will immediately reappear in the active queue, and its database log entry will delete.

### Audio Alerts & SLA Breaches
* Alert cards have value-based timers (2m, 5m, or 10m).
* If you leave the tab inactive or look at another screen, the console will play a **double-beep alarm** the moment any alert's timer hits `0` (SLA Breached). The breached card will glow red and jump to the top of the queue.

---

## 📈 2. Risk Manager: Threshold Simulation Workflow (Threshold Simulator Tab)

### Segmented Currency Toggle & Conversion
* Switch the active reporting currency dynamically using the **SAR / AED** segmented toggle pill at the top of the Simulator outputs column.
* The system utilizes a pegged exchange rate (**1 AED = 1.02 SAR** and **1 SAR = 0.98 AED**) to convert and re-aggregate all metrics, financial cost calculators, recommendation engine thresholds, and uploader values.

### Adjusting Thresholds
* Drag the **Master Composite Risk Threshold** slider in the right panel.
* Expand the **Advanced Layer Thresholds** accordion to fine-tune individual Device, Behavioral, or Transaction cutoff scores.
* Observe that metric values (Catch Rate, False Positive Rate, Fraud Loss, False Decline Cost) adjust live as you drag.

### Interactive Precision-Recall Frontier Chart
* View the **Precision-Recall Tradeoff Frontier** canvas to inspect risk tradeoffs:
  * **Pulsing Blue Dot**: Current $(FPR, TPR)$ settings position based on live sliders.
  * **Green Dot**: Mathematically optimal recommendations coordinate.
* **Canvas Hover**: Moving the mouse over the curve shows tooltips with exact statistics: `Threshold: [X] | Catch: [Y]% | FP: [Z]%`.
* **Click-to-Snap snap calibration**: Click directly on any point along the Indigo frontier curve to snap the Master composite threshold slider (and proportionately scale layer sliders) to that value instantly.

### 90-Day Drift Analytics & Telemetry Dashboard
* Monitor the **90-Day Model Drift & Telemetry** chart at the bottom of the simulator inputs column.
* The canvas plots the Catch Rate decay curve over 90 days against SAMA compliance limit (70%) and your active composite threshold line.
* If model drift degrades the Catch Rate below 70%:
  * A flashing orange **Telemetry Drift Warning** badge appears at the header.
  * The footer turns yellow and displays estimated leakage/friction savings from recalibrating to the optimal recommendation.
  * A warning is printed to the Compliance Audit log.

### Running Custom CSV Simulations
* Construct a CSV file with the following columns:
  `transaction_id, amount, currency, merchant_category, risk_score, is_fraud`
* Click the **Choose Anonymized Bank CSV** button.
* Select your CSV file (you can download the pre-made template by clicking **Template CSV** first).
* The console will automatically recompute metrics, Optimal recommendation settings, and load high-risk transactions directly into the queue.

### Compliance Checks & Locking Workflow
* Under CBUAE (UAE) guidelines, risk operations must minimize customer friction. If your selected threshold yields a False Positive Rate higher than **30%**, a red **Compliance Warning** banner will appear.
* Use the **Threshold Recommendation Engine** advice box to view the mathematically optimal threshold value that balances cost and analyst capacity.
* **Enforce Regulatory Compliance Mode**: Toggle this switch to activate CBUAE / SAMA guardrails. If active and the FPR exceeds 30%:
  1. The **Commit Threshold Policy** button is locked.
  2. A deviation justification textarea slides down, requiring a detailed memo entry of **at least 20 characters**.
  3. Once a valid justification is typed, the commit button unlocks.

---

## 🔍 3. Compliance Auditor: Accessing Audit Trails

* Triage actions are logged live in the **Compliance Audit Trail** terminal in the bottom-right footer as simulated SQL operations.
* **Committing Policy Rationale**: Clicking "Commit Threshold Policy" logs the threshold policy change to the local log terminal as an `INSERT` statement and triggers a browser download of `MOZN_Compliance_Rationale.txt`. This document forms a formal GCC compliance audit memo containing full metric details, cutoff settings, and the risk manager's deviation rationale.
* **To audit database entries**:
  1. Open Chrome DevTools (`F12` or right-click -> Inspect).
  2. Navigate to the **Application** tab (Application -> Local Storage -> file:// / http://localhost:5173).
  3. Select the key `fraud_audit_log` to view JSON database inserts containing transaction details, user actions, timestamps, and signal attributions.
* Click **Clear Local Log** to empty the audit table.
