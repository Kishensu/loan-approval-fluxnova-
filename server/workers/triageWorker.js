require('dotenv').config();
const axios = require('axios');

const ENGINE = process.env.FLUXNOVA_URL || 'http://localhost:8080/engine-rest';
const WORKER_ID = 'triage-worker-1';
const TOPIC = 'request-triage';
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
    console.error('[TRIAGE] Could not report failure:', e.message);
  }
}

function triage(requestType, amount) {
  const t = String(requestType || '').toLowerCase();
  const a = Number(amount || 0);

  if (t === 'loan' && a >= 100000) return { category: 'major-lending', priority: 'high',   interestRate: 0.055, feePercent: 1.0 };
  if (t === 'loan')                return { category: 'retail-lending', priority: 'normal', interestRate: 0.065, feePercent: 1.5 };
  if (t === 'refund')              return { category: 'refunds',        priority: 'normal', interestRate: 0,     feePercent: 2.0 };
  if (t === 'account')             return { category: 'servicing',      priority: 'low',    interestRate: 0,     feePercent: 0   };
  return                                  { category: 'manual-triage',  priority: 'high',   interestRate: 0,     feePercent: 0   };
}

async function processTask(task) {
  const vars = task.variables || {};
  const requestType = vars.requestType?.value;
  const amount      = vars.amount?.value;

  try {
    const result = triage(requestType, amount);
    await engine.post(`/external-task/${task.id}/complete`, {
      workerId: WORKER_ID,
      variables: {
        category:     { value: result.category,     type: 'String' },
        priority:     { value: result.priority,     type: 'String' },
        interestRate: { value: result.interestRate, type: 'Double' },
        feePercent:   { value: result.feePercent,   type: 'Double' },
      },
    });
    console.log(`[TRIAGE] Task ${task.id} | ${requestType} $${amount} → ${result.category}/${result.priority}`);
  } catch (err) {
    console.error(`[TRIAGE] Task ${task.id} failed:`, err.message);
    await reportFailure(task, err);
  }
}

async function poll() {
  try {
    const res = await engine.post('/external-task/fetchAndLock', {
      workerId: WORKER_ID,
      maxTasks: 10,
      usePriority: false,
      topics: [{ topicName: TOPIC, lockDuration: LOCK_DURATION_MS, variables: ['requestType', 'amount'] }],
    });
    const tasks = res.data;
    if (tasks.length === 0) return;
    await Promise.all(tasks.map(processTask));
  } catch (err) {
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(err.code)) {
      console.log('[TRIAGE] Engine not reachable, retrying...');
    } else {
      console.error('[TRIAGE] Poll error:', err.response?.data?.message || err.message);
    }
  }
}

let intervalId = null;

function start() {
  if (intervalId) return;
  console.log('[TRIAGE] Triage worker started');
  intervalId = setInterval(poll, POLL_INTERVAL_MS);
}

function stop() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
}

module.exports = { start, stop };
