require('dotenv').config();
const axios = require('axios');

const ENGINE = process.env.FLUXNOVA_URL || 'http://localhost:8080/engine-rest';
const WORKER_ID = 'rate-decision-worker-1';
const TOPIC = 'rate-decision';
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
    console.error('[RATE] Could not report failure:', e.message);
  }
}

function assignRate(creditScore) {
  const s = Number(creditScore || 0);
  if (s >= 750) return { rateTier: 'Prime',     interestRate: 4.5  };
  if (s >= 600) return { rateTier: 'Standard',  interestRate: 7.9  };
  return             { rateTier: 'Sub-prime',  interestRate: 12.5 };
}

async function processTask(task) {
  const vars = task.variables || {};
  const creditScore = vars.creditScore?.value;

  try {
    const result = assignRate(creditScore);
    await engine.post(`/external-task/${task.id}/complete`, {
      workerId: WORKER_ID,
      variables: {
        rateTier:     { value: result.rateTier,     type: 'String' },
        interestRate: { value: result.interestRate, type: 'Double' },
      },
    });
    console.log(`[RATE] Task ${task.id} | score ${creditScore} → ${result.rateTier} @ ${result.interestRate}%`);
  } catch (err) {
    console.error(`[RATE] Task ${task.id} failed:`, err.message);
    await reportFailure(task, err);
  }
}

async function poll() {
  try {
    const res = await engine.post('/external-task/fetchAndLock', {
      workerId: WORKER_ID,
      maxTasks: 10,
      usePriority: false,
      topics: [{ topicName: TOPIC, lockDuration: LOCK_DURATION_MS, variables: ['creditScore'] }],
    });
    const tasks = res.data;
    if (tasks.length === 0) return;
    await Promise.all(tasks.map(processTask));
  } catch (err) {
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(err.code)) {
      console.log('[RATE] Engine not reachable, retrying...');
    } else {
      console.error('[RATE] Poll error:', err.response?.data?.message || err.message);
    }
  }
}

let intervalId = null;

function start() {
  if (intervalId) return;
  console.log('[RATE] Rate decision worker started');
  intervalId = setInterval(poll, POLL_INTERVAL_MS);
}

function stop() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
}

module.exports = { start, stop };
