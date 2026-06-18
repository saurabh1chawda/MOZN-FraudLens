# MOZN FraudLens: Real-Time Fraud Triage & Threshold Intelligence Console

MOZN FraudLens is an operations-facing risk triage and threshold simulation console designed specifically for fraud operations teams at GCC financial institutions (Saudi Arabia, UAE, Kuwait). 

Surfacing MOZN’s machine learning layer signals in a clean, triageable interface, FraudLens helps fraud analysts process transactions quickly and provides risk managers with business-framed cost metrics to tune live transaction rules.

---

## 🎨 Key Features

1. **Signal-Attributed Triage Console (Master-Detail Layout)**: 
   * Sleek dark-mode interface designed with modern glassmorphic panels.
   * Tabbed workspace separating the **Triage Console** (Analysts) and **Threshold Simulator** (Risk Managers).
   * **Explainable AI (XAI) Engine**: Translates raw semicolon-delimited feature strings (e.g. `dev_fp_mismatch:0.92;vpn_active:1`) into plain-language indicators (e.g. `🚨 Device Fingerprint Mismatch (Value: 0.92)` and `🚨 VPN Connection Active`).
   * **Trigger Reasons**: Explicit badges displaying which layer threshold forced the alert (composite master vs. specific custom cutoffs).
   * **Value-Based SLA Allocation**:
     * Transactions < 1,000 currency units: **2 minutes (120s)**
     * Transactions 1,000 to 10,000 currency units: **5 minutes (300s)**
     * Transactions > 10,000 currency units: **10 minutes (600s)**
   * **Web Audio Breach Alarm**: Soft double-beep warning played via Web Audio API the instant a countdown timer breaches `0`.
   * **Scroll Position Memory**: Preserves vertical scroll position on alert triage actions to prevent container jump.
   * **Triage History & Undo (5 Mins)**: Allows analysts to undo triage decisions within 5 minutes, restoring the card and removing log database entries.
   * **Segmented LHS Queue Sorting**: Toggle alert queue sorting on-click between Priority score, raw Risk Score, SLA Remaining, or group by Layer.

2. **Threshold Intelligence & Business Impact Simulator**:
   * Interactive master threshold slider (0-100) and advanced accordion sliders for Device, Behavioral, and Transaction layers.
   * **Segmented Currency Toggle & Pegged Converter**: Switch active reporting currency (AED vs. SAR) using pegged exchange rates (**1 AED = 1.02 SAR** and **1 SAR = 0.98 AED**) to convert and re-aggregate all transaction values, live metrics, and optimal recommendation calculations.
   * **Live Client-Side Metrics**: Calculates True Positive Rate (TPR), False Positive Rate (FPR), Monthly Fraud Loss, and False Decline Cost (Friction) instantly in active currency.
   * **Compliance Guardrails**: Warns managers if the False Positive Rate exceeds CBUAE Consumer Protection guidelines (>30%).
   * **Threshold Recommendation Engine**: Computes the mathematically optimal composite score to minimize total operational and leakage costs.

3. **Interactive Precision-Recall Frontier (HTML5 Canvas)**:
   * Draws solid Indigo Bezier tradeoff path, background grids, pulsing blue settings marker, and green optimal recommended star marker.
   * Handles High-DPI / Retina screens cleanly using `devicePixelRatio` display style locking.
   * Displays floating canvas tooltips on mouse move and snaps all threshold sliders proportionately on click.

4. **90-Day Drift Analytics & Warning Telemetry**:
   * Renders Catch Rate decay curve, active threshold line, and SAMA 70% limit line on a unified canvas.
   * Triggers flashing telemetry alert badge, warning logs written in compliance terminal, and displays estimated calibration ROI savings.

5. **Regulatory Compliance Mode & Audit Rationale Exporter**:
   * **Compliance Mode**: A strict toggle that locks policy commits if the False Positive Rate exceeds 30%.
   * **Justification locking**: Requires a justification text memo (min 20 characters) explaining deviation from regulatory guidelines before unlocking the commit button.
   * **Rationale Exporter**: Committing the threshold policy writes simulated SQL commands to the compliance terminal and triggers a browser download of `MOZN_Compliance_Rationale.txt` (a formal GCC compliance audit memo).
   * **LocalStorage Audit Trail**: Simulates a SQL database table `fraud_audit_log` inside `localStorage` to log triage decisions.

---

## 🛠️ Technology Stack

* **Frontend**: HTML5, Vanilla CSS3 (Custom properties, grid layout, animations), Vanilla JavaScript (ES6+).
* **Mock Database**: Browser `localStorage` APIs.
* **Audio Alerts**: Web Audio API (No external asset dependency).
* **Dev Server**: `http-server` (NodeJS-based).

---

## 🚀 Setup & Installation

Follow these steps to run the interactive prototype locally:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation
1. Clone or download the repository into your workspace directory.
2. Open terminal in the project directory and run:
   ```bash
   npm install
   ```

### Running Locally
To launch the development server, run:
```bash
npm run dev
```
The console will start at `http://localhost:5173`. Open this URL in any modern browser.

---

## 📁 Repository Structure

```
├── index.html               # Main dashboard UI structure
├── index.css                # Visual design system, dark-theme layout & transitions
├── app.js                   # Application state engine, timers, calculations & CSV parser
├── sample_transactions.csv  # Pre-defined transaction profile data for simulator uploader
├── package.json             # NPM dependencies & scripts
└── package-lock.json        # Locked dependency tree
```
