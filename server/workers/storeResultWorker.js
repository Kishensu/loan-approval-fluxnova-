require('dotenv').config();
const axios = require('axios');
const resultStore = require('../store/results');

const ENGINE = process.env.FLUXNOVA_URL || 'http://localhost:8080/engine-rest';
const WORKER_ID = 'store-result-worker-1';
const TOPIC = 'store-result';
const POLL_INTERVAL_MS = 3000;
const LOCK_DURATION_MS = 10000;

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
    console.error('[STORE] Could not report failure:', e.message);
  }
}

async function processTask(task) {
  const vars = task.variables || {};
  const processInstanceId  = task.processInstanceId;
  const needsReview        = Boolean(vars.needsReview?.value);
  const category           = String(vars.category?.value           || '');
  const priority           = String(vars.priority?.value           || '');
  const originalFilename   = String(vars.originalFilename?.value   || '');
  const documentId         = String(vars.documentId?.value         || '');
  const requestType        = String(vars.requestType?.value        || '');
  const amount             = Number(vars.amount?.value             ?? 0);

  let fields = {};
  try { fields = JSON.parse(vars.extractedFields?.value || '{}'); } catch {}

  let calculationResult = {};
  try { calculationResult = JSON.parse(vars.calculationResult?.value || '{}'); } catch {}

  const record = {
    processInstanceId,
    documentId,
    originalFilename,
    submittedAt: null,
    completedAt: new Date().toISOString(),
    // Canonical top-level scalars (normalized by extraction worker)
    requestType,
    amount,
    // Raw per-field extraction (used by review queue and detail drawer)
    fields,
    wasReviewed: needsReview,
    category,
    priority,
    calculationResult,
  };

  try {
    const histRes = await engine.get(`/history/process-instance/${processInstanceId}`);
    record.submittedAt = histRes.data.startTime || record.completedAt;
  } catch {}

  try {
    resultStore.save(processInstanceId, record);

    await engine.post(`/external-task/${task.id}/complete`, {
      workerId: WORKER_ID,
      variables: {},
    });

    console.log(`[STORE] Task ${task.id} | Stored result for instance ${processInstanceId}`);
  } catch (err) {
    console.error(`[STORE] Task ${task.id} failed:`, err.message);
    await reportFailure(task, err);
  }
}

async function poll() {
  try {
    const res = await engine.post('/external-task/fetchAndLock', {
      workerId: WORKER_ID,
      maxTasks: 10,
      usePriority: false,
      topics: [{
        topicName: TOPIC,
        lockDuration: LOCK_DURATION_MS,
        variables: [
          'extractedFields', 'needsReview', 'category', 'priority',
          'calculationResult', 'originalFilename', 'documentId',
          'requestType', 'amount',
        ],
      }],
    });
    const tasks = res.data;
    if (tasks.length === 0) return;
    await Promise.all(tasks.map(processTask));
  } catch (err) {
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(err.code)) {
      console.log('[STORE] Engine not reachable, retrying...');
    } else {
      console.error('[STORE] Poll error:', err.response?.data?.message || err.message);
    }
  }
}

let intervalId = null;

function start() {
  if (intervalId) return;
  console.log('[STORE] Store result worker started');
  intervalId = setInterval(poll, POLL_INTERVAL_MS);
}

function stop() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  console.log('[STORE] Store result worker stopped');
}

module.exports = { start, stop };
