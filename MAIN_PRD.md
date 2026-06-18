# MAIN_PRD.md
## PRODUCT REQUIREMENTS DOCUMENT: MOZN FraudLens
### Real-Time Fraud Triage & Threshold Intelligence Console

---

### STEP 1: Clarifying Questions
Establishing constraints, context, and assumptions before defining the product direction.

1. **Stage of company**: Are we building from scratch or enhancing an existing platform?
   * *Answer*: MOZN has an existing Anti-Fraud Platform with device, behavioral, and transaction intelligence layers. FraudLens is a new product layer—a PM/ops-facing console surfacing the platform's signals in a triageable, configurable interface.
2. **Primary user**: Who is the day-to-day user of this console?
   * *Answer*: Fraud Operations Analysts at GCC banks. They work in alert queues, triage flagged transactions, and escalate or clear cases. They need actionable decisions and context, not raw model data.
3. **Customer type**: B2B enterprise or direct consumer?
   * *Answer*: B2B enterprise. Customers are licensed GCC financial institutions (banks, digital wallets) in Saudi Arabia, UAE, and Kuwait.
4. **Regulatory environment**: Are there compliance constraints?
   * *Answer*: Yes. SAMA (Saudi Arabia) Consumer Protection Principles and CBUAE (UAE) guidelines apply. The product must support audit trails, explainability, and threshold documentation (warning if FPR exceeds 30%).
5. **Time & resource constraints**: What is the scope of this build?
   * *Answer*: Scoped for a 12-week MVP sprint with a squad of 2 engineers, 1 designer, and 1 PM.
6. **GCC market specifics**: Are there localization requirements?
   * *Answer*: Yes. Currency handling in SAR and AED, GCC merchant categories (remittances, gold souqs), and regional regulatory framing.

---

### STEP 2: Goal Setting
What we are trying to achieve and why it matters to MOZN's business.

* **Product Type**: Improving an existing platform by adding a new PM/ops-facing product layer.
* **Goal Category**: Customer Adoption + Revenue Retention (reduce churn from ops dissatisfaction; increase expansion via analyst productivity gains).
* **North Star Goal**: Enable GCC fraud operations teams to reduce mean-time-to-decision (MTTD) on fraud alerts by 50% and reduce false positive escalation rate by 30% within 90 days of deployment.
* **Supporting Business Goals**:
  * Churn reduction at existing bank clients.
  * Accelerate new bank onboarding by providing a demo-ready console.
  * Automate regional compliance documentation for audits.

---

### STEP 3: Define Users
User segments defined by activities and workflow roles.

1. **Fraud Operations Analyst (Primary Persona)**
   * *Activity*: Works the alert queue daily. Triages flagged transactions (Block, Review, Allow). Writes case notes.
   * *Volume/Frequency*: High volume (50–500 alerts/day). Daily interaction.
2. **Fraud Risk Manager / Head of Fraud (Secondary Persona)**
   * *Activity*: Sets fraud strategy, reviews team SLA compliance, and owns the threshold policy.
   * *Volume/Frequency*: Medium volume. Weekly/monthly strategic reviews.
3. **MOZN Implementation PM (Tertiary Persona)**
   * *Activity*: Configures FraudLens for new bank deployments and reviews client integration health.
   * *Volume/Frequency*: Low volume. Setup and quarterly reviews.

---

### STEP 4: User Pain Points
Targeting the **Fraud Operations Analyst** to maximize the North Star Goal:

1. **P1: Alert Fatigue from Opaque Risk Scores & Visual Clutter**
   * *Root Cause*: Previous flat queues loaded risk details, attribution lists, and action buttons for all alerts simultaneously. This caused massive visual fatigue and scroll friction, slowing decision-making.
2. **P2: Static SLAs Misaligned with Transaction Value**
   * *Root Cause*: Alerts carried a flat 5-minute countdown regardless of risk or value. Large-scale gold purchases require deep verification, while fuel charges require rapid clearance. Static timers cause analysts to breach SLA boundaries or ignore alarms due to alert desensitization.
3. **P3: Manual Compliance Reporting & Opacity in Slider Changes**
   * *Root Cause*: Risk managers adjusted thresholds in backend pipelines without immediate business impact visibility, causing sudden queue surges. Compliance reporting for SAMA/CBUAE was manual, requiring copying data into spreadsheets.

---

### STEP 5: Solutions
Improve the console to solve all three pain points:

1. **Solution 1 (Reasonable): Compact Inbox-Style Feed with Expanding Cards**
   * *Solves*: P1 (Visual Clutter & Scroll Jump Fatigue)
   * *Description*: Cards are rendered in a compact, collapse-first format (~70px height) showing only Transaction ID, Amount, Category, Score, and SLA. Clicking a card expands it with a smooth transition to reveal layer signals and actions.
2. **Solution 2 (Reasonable): Value-Based Dynamic SLAs & Audio Breach Alarms**
   * *Solves*: P2 (Timer Desensitization)
   * *Description*: Timer values scale automatically: 2m for <1,000 currency units, 10m for >10,000, and 5m for mid-range. A soft oscillator double-beep alarm triggers via the Web Audio API when an alert hits `0:00`.
3. **Solution 3 (Moonshot): Autonomous Fraud Rule Synthesizer with Auto-Documentation**
   * *Solves*: P3 (Manual Compliance Reporting)
   * *Description*: An AI engine analyzes resolved case outcomes, proposes optimal threshold cuts, and generates a pre-formatted SAMA/CBUAE compliance PDF justifying the change.

---

### STEP 6: Prioritize Features
Using the High-Medium-Low (HML) framework to sequence features that maximize the goal:

| Feature | Pain Point | Impact | Effort | Urgency | Status (MVP) |
|---|---|---|---|---|---|
| **Compact Cards & Toggle Expand** | P1 | HIGH | Medium | HIGH | MVP (Implemented) |
| **Scroll Position Memory** | P1 | HIGH | Low | HIGH | MVP (Implemented) |
| **Dynamic Value-Based SLAs** | P2 | HIGH | Medium | HIGH | MVP (Implemented) |
| **Web Audio Breach Alarms** | P2 | HIGH | Low | HIGH | MVP (Implemented) |
| **Dynamic Currency Detection (SAR/AED)** | P3 | HIGH | Medium | HIGH | MVP (Implemented) |
| **Compliance Warn (FPR > 30%)** | P3 | HIGH | Low | HIGH | MVP (Implemented) |
| **LocalStorage SQL Audit Log** | P3 | HIGH | Low | HIGH | MVP (Implemented) |
| **Visual CSV Template Button** | P1 | Medium | Low | Medium | MVP (Implemented) |
| **Explainable AI (XAI) Parser** | P1 | HIGH | Medium | HIGH | MVP - Phase E (Implemented) |
| **Segmented Currency Selector & Peg** | P3 | HIGH | Medium | HIGH | MVP - Phase E (Implemented) |
| **Compliance Mode Locking & Justification** | P3 | HIGH | HIGH | HIGH | MVP - Phase E (Implemented) |
| **Compliance Rationale Memo Exporter** | P3 | HIGH | Medium | HIGH | MVP - Phase E (Implemented) |
| **AI Rule Synthesizer (Moonshot)** | P3 | HIGH | HIGH | Low | Phase 3 (Out of Scope) |

---

### STEP 7: Phase E - GCC Localization & Explainable AI Suite Specifications

#### 1. Explainable AI (XAI) Translation Engine
* Surfaced risk signals are parsed from raw model key-value tags (e.g. `dev_fp_mismatch:0.92;vpn_active:1`).
* Translation engine matches keys to a local translation map and displays clean, plain-language text to analysts (e.g. `🚨 Device Fingerprint Mismatch (Value: 0.92)`).

#### 2. Segmented Currency Selector & Pegged Converter
* Pill-style sliding toggle selector switches active currency (AED/SAR).
* Pegged exchange rate calculations (**1 AED = 1.02 SAR** and **1 SAR = 0.98 AED**) dynamically convert metrics, optimal recommendations, and alert list amounts.

#### 3. Regulatory Compliance Mode & locked commits
* When Compliance Mode is active and the False Positive Rate exceeds 30%:
  * Committing a threshold policy is locked.
  * Risk managers must input a compliance justification memo (minimum 20 characters) explaining deviation from CBUAE/SAMA guidelines to unlock commits.
* Commits output simulated SQL commands in the terminal and download a structured formal bank audit memo: `MOZN_Compliance_Rationale.txt`.

---

### STEP 8: Measure Success
Tying features directly to key operational outcomes.

1. **North Star Metric**:
   * *Mean Time to Decision (MTTD)*: Goal is a 50% reduction in median decision time per alert.
2. **Signpost Metrics**:
   * *Analyst Card Interaction Rate*: Percentage of analysts utilizing the compact click-to-expand list rather than filtering.
   * *SLA Breach Rate*: Alert SLA breaches reduced by 25% due to value-based timer adjustments.
   * *Simulation-to-Deployment Ratio*: >80% of threshold changes preceded by a simulator run.
3. **Do No Harm (Guardrails)**:
   * *False Decline Cost*: Ensure false decline friction does not increase by >5%.
   * *Platform Latency*: Client-side pre-computations must render slider recalculations under 50ms (P95).
   * *Bypass Rate*: Analysts making triage decisions outside the console queue must remain <10%.
