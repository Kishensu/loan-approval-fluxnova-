# loan-approval-fluxnova-

A FluxNova (Camunda 7) demo platform combining BPM orchestration, AI, and Lean Six Sigma principles. Two full-stack use cases run on a shared engine:

| Use case | Route | Status |
|---|---|---|
| AI-Powered Loan Approval | `/apply` | Live |
| Intelligent Form Processing | `/form-processing` | Live |

---

## Intelligent Form Processing

### What it does

Upload any form image or PDF. The pipeline:

```
Upload → [AI Field Extraction] → All confident?
                                  ├─ yes ──────────────────────┐
                                  └─ no → [Human Review Queue] ┘
                                                                ↓
                                            [DMN Triage] → [Calculate] → [Store]
```

1. **AI Field Extraction** — Donut DocVQA (`naver-clova-ix/donut-base-finetuned-docvqa`) reads the form and answers questions for each target field.
2. **Confidence gating** — any field below `CONFIDENCE_THRESHOLD` (default 0.85) sends the form to the human review queue instead of continuing automatically.
3. **Human Review Queue** (`/review-queue`) — shows the original form image alongside AI-extracted values. Low-confidence fields are highlighted amber. Submitting corrected values completes the user task and resumes the process.
4. **DMN Triage** — `triage-request.dmn` maps (`requestType`, `amount`) to `category`, `priority`, `interestRate`, `feePercent`:

   | requestType | amount | category | priority | rate | fee |
   |---|---|---|---|---|---|
   | loan | ≥ 100,000 | major-lending | high | 5.5% | 1.0% |
   | loan | < 100,000 | retail-lending | normal | 6.5% | 1.5% |
   | refund | any | refunds | normal | 0% | 2.0% |
   | account | any | servicing | low | 0% | 0% |
   | (other) | any | manual-triage | high | 0% | 0% |

5. **Calculation** — amortisation schedule (loans), net refund, or flat processing fee.
6. **Store** — JSON record written to `data/results/` (Docker volume-mounted).

### Target fields

`applicantName`, `requestType`, `amount`, `requestDate`, `description` — defined in `server/config/formFields.js` (shared by all workers and the review UI).

### Demo paths

**Straight-through (clean form):**
1. Go to `/form-processing`
2. Click **"Clean form"** sample button
3. Watch the pipeline stages pulse through Extract → Triage → Calculate → Stored
4. No review task is created; result appears immediately

**Review path (messy form):**
1. Click **"Messy form"** sample button
2. Pipeline pauses at **Review** stage
3. Open `/review-queue`, select the pending task
4. Correct low-confidence fields (highlighted amber), Submit
5. Pipeline resumes; result appears in `/results`

### Swapping the extraction provider

The extraction worker contract is `extractedFields` (JSON with `{name: {value, confidence}}`) + `needsReview` (Boolean). Replacing the Donut worker with Claude Vision or Azure Document Intelligence requires only changing `server/workers/extractionWorker.js` — the BPMN and downstream workers are untouched.

### Editing the triage DMN live

Open Cockpit at `http://localhost:8080` → Deployments → `triage-request` → edit and redeploy. New submissions immediately use the updated rules.

---

## Loan Approval

Classic human-in-the-loop lending flow: application submit → credit check (external worker) → rate decision (DMN) → manager review → decision. See `/apply` and `/manager`.

---

## Quick start

```bash
# Copy and fill credentials (default: demo/demo for local Fluxnova)
cp .env.example .env   # or edit .env directly

docker compose up -d
```

> **First run**: the `docai-service` build downloads ~1.5 GB (Donut model weights + CPU-only PyTorch). This takes several minutes and requires internet access. Subsequent builds use the Docker layer cache.

Services:

| Service | Port | Purpose |
|---|---|---|
| fluxnova | 8080 | BPM engine (Cockpit + REST API) |
| docai-service | 8000 | Python FastAPI — Donut DocVQA inference |
| server | 3001 | Node.js API + 4 external task workers |
| client | 80 | React SPA (nginx, proxies `/api/` → server) |
| deployer | — | One-shot: deploys both BPMN + DMN to engine |

**Results land in:** Docker named volume `results` → `data/results/{processInstanceId}.json` inside the server container.

---

## Project layout

```
├── process/             Loan approval BPMN + DMN
├── workflows/           IFP BPMN + Triage DMN  ← new
├── docai-service/       Python FastAPI (Donut inference)  ← new
├── server/
│   ├── config/formFields.js   shared field definitions  ← new
│   ├── store/results.js        JSON file persistence  ← new
│   ├── workers/
│   │   ├── creditCheckWorker.js
│   │   ├── extractionWorker.js    ← new
│   │   ├── calculationWorker.js   ← new
│   │   └── storeResultWorker.js   ← new
│   └── routes/
│       ├── forms.js    upload, status, document  ← new
│       ├── review.js   review queue  ← new
│       └── results.js  stored results  ← new
└── client/src/
    ├── pages/
    │   ├── FormProcessingPage.jsx  ← new
    │   ├── ReviewQueuePage.jsx     ← new
    │   └── ResultsPage.jsx         ← new
    └── hub/demos.js  (IFP entry replaces ai-document-analysis placeholder)
```
