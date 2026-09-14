require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { FIELDS } = require('../config/formFields');

const ENGINE = process.env.FLUXNOVA_URL || 'http://localhost:8080/engine-rest';
const DOCAI_URL = process.env.DOCAI_SERVICE_URL || 'http://localhost:8000';
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.85');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const WORKER_ID = 'extraction-worker-1';
const TOPIC = 'form-extraction';
const POLL_INTERVAL_MS = 3000;
const LOCK_DURATION_MS = 120000; // AI inference can take up to 2 min per form on CPU

const engine = axios.create({
  baseURL: ENGINE,
  auth: {
    username: process.env.FLUXNOVA_USER || 'demo',
    password: process.env.FLUXNOVA_PASS || 'demo',
  },
});

async function reportFailure(task, err) {
  const retries = task.retries != null ? task.retries - 1 : 2;
  try {
    await engine.post(`/external-task/${task.id}/failure`, {
      workerId: WORKER_ID,
      errorMessage: String(err.message || 'Unknown error').slice(0, 500),
      retries,
      retryTimeout: 10000,
    });
  } catch (e) {
    console.error('[EXTRACTION] Could not report failure:', e.message);
  }
}

async function processTask(task) {
  const vars = task.variables || {};
  const documentId = vars.documentId?.value;

  if (!documentId) {
    await reportFailure(task, new Error('Missing documentId variable'));
    return;
  }

  const filePath = path.join(UPLOADS_DIR, documentId);
  if (!fs.existsSync(filePath)) {
    await reportFailure(task, new Error(`Upload not found: ${documentId}`));
    return;
  }

  try {
    const image_base64 = fs.readFileSync(filePath).toString('base64');

    let aiRes;
    try {
      aiRes = await axios.post(
        `${DOCAI_URL}/extract`,
        {
          image_base64,
          fields: FIELDS.map((f) => ({ name: f.name, question: f.question })),
        },
        { timeout: 150000 }
      );
    } catch (aiErr) {
      // 503 = docai model still loading after cold start; retry with extra patience
      if (aiErr.response?.status === 503) {
        const retries = task.retries != null ? task.retries - 1 : 9;
        console.log(`[EXTRACTION] Task ${task.id} — DocAI model loading, retrying in 30s (retries left: ${retries})`);
        await engine.post(`/external-task/${task.id}/failure`, {
          workerId: WORKER_ID,
          errorMessage: 'DocAI model not ready yet — cold start warm-up',
          retries,
          retryTimeout: 30000,
        });
        return;
      }
      throw aiErr;
    }

    const raw = aiRes.data.fields;

    // Parse amount: strip currency symbols and commas, convert to number
    if (raw.amount) {
      const stripped = String(raw.amount.value).replace(/[$,\s]/g, '');
      const num = parseFloat(stripped);
      if (!isNaN(num)) {
        raw.amount.value = num;
      } else {
        raw.amount.value = 0;
        raw.amount.confidence = 0;
      }
    }

    const lowConfidenceFields = Object.entries(raw)
      .filter(([, v]) => (v.confidence ?? 0) < CONFIDENCE_THRESHOLD)
      .map(([k]) => k);

    const needsReview = lowConfidenceFields.length > 0;

    // Normalize requestType to canonical lowercase values the DMN can match.
    // Donut often reads a neighbouring field value (e.g. the amount "$250,000") instead
    // of the type label. When that happens we fall back to keyword-matching the description.
    const rawType    = String(raw.requestType?.value || '');
    const descText   = String(raw.description?.value || '').toLowerCase();

    const inferFromText = (text) => {
      if (/[il][o0]a[nm]|mortgage|borrow|lend/.test(text)) return 'loan';
      if (/refund|reimburse|return|rebate/.test(text))      return 'refund';
      if (/account|acct|service/.test(text))                return 'account';
      return null;
    };

    const normalizedType = (() => {
      const lc = rawType.toLowerCase().trim();

      // Direct type-label match (includes OCR variants like "Ioan", "loam")
      const direct = inferFromText(lc);
      if (direct) return direct;

      // Model extracted a dollar/numeric value for the wrong field — use description
      if (/^\$?[\d,]+\.?\d*$/.test(lc.replace(/\s/g, ''))) {
        return inferFromText(descText) ?? 'unknown';
      }

      // Empty or unrecognised — last resort: description
      return inferFromText(descText) ?? (lc || 'unknown');
    })();

    await engine.post(`/external-task/${task.id}/complete`, {
      workerId: WORKER_ID,
      variables: {
        extractedFields:      { value: JSON.stringify(raw),                        type: 'String' },
        needsReview:          { value: needsReview,                                type: 'Boolean' },
        lowConfidenceFields:  { value: JSON.stringify(lowConfidenceFields),         type: 'String' },
        // Top-level vars so the DMN and subsequent workers can read them directly
        requestType:          { value: normalizedType,                             type: 'String' },
        amount:               { value: Number(raw.amount?.value       || 0),       type: 'Double' },
        applicantName:        { value: String(raw.applicantName?.value || ''),     type: 'String' },
        requestDate:          { value: String(raw.requestDate?.value   || ''),     type: 'String' },
        description:          { value: String(raw.description?.value   || ''),     type: 'String' },
      },
    });

    console.log(`[EXTRACTION] Task ${task.id} | needsReview:${needsReview} | low:[${lowConfidenceFields.join(',')}]`);
  } catch (err) {
    console.error(`[EXTRACTION] Task ${task.id} failed:`, err.message);
    await reportFailure(task, err);
  }
}

async function poll() {
  try {
    const res = await engine.post('/external-task/fetchAndLock', {
      workerId: WORKER_ID,
      maxTasks: 3,
      usePriority: false,
      topics: [{
        topicName: TOPIC,
        lockDuration: LOCK_DURATION_MS,
        variables: ['documentId', 'originalFilename'],
      }],
    });
    const tasks = res.data;
    if (tasks.length === 0) return;
    // Sequential: AI inference is CPU-bound — no benefit in parallelising
    for (const task of tasks) await processTask(task);
  } catch (err) {
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(err.code)) {
      console.log('[EXTRACTION] Engine not reachable, retrying...');
    } else {
      console.error('[EXTRACTION] Poll error:', err.response?.data?.message || err.message);
    }
  }
}

let intervalId = null;

function start() {
  if (intervalId) return;
  console.log('[EXTRACTION] Extraction worker started');
  intervalId = setInterval(poll, POLL_INTERVAL_MS);
}

function stop() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  console.log('[EXTRACTION] Extraction worker stopped');
}

module.exports = { start, stop };
