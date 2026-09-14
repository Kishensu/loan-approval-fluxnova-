require('dotenv').config();
const axios = require('axios');

const ENGINE = process.env.FLUXNOVA_URL || 'http://localhost:8080/engine-rest';
const WORKER_ID = 'calculation-worker-1';
const TOPIC = 'request-calculation';
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
    console.error('[CALCULATION] Could not report failure:', e.message);
  }
}

function monthlyPayment(principal, annualRate, months) {
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function processTask(task) {
  const vars = task.variables || {};
  const category     = String(vars.category?.value     || '');
  const interestRate = Number(vars.interestRate?.value  || 0);
  const feePercent   = Number(vars.feePercent?.value    || 0);

  // The extraction worker stores amount inside extractedFields JSON;
  // reviewer may have corrected it, so always read from extractedFields.
  let amount = 0;
  try {
    const fields = JSON.parse(vars.extractedFields?.value || '{}');
    amount = Number(fields.amount?.value || 0);
  } catch {}

  let calculationResult;

  try {
    if (category.includes('lending')) {
      const months = 60;
      const mp = monthlyPayment(amount, interestRate, months);
      const fee = amount * (feePercent / 100);
      calculationResult = {
        type: 'loan',
        principal: round2(amount),
        annualRate: interestRate,
        months,
        monthlyPayment: round2(mp),
        fee: round2(fee),
        totalCost: round2(mp * months + fee),
      };
    } else if (category === 'refunds') {
      const fee = amount * (feePercent / 100);
      calculationResult = {
        type: 'refund',
        refundAmount: round2(amount),
        fee: round2(fee),
        netRefund: round2(amount - fee),
      };
    } else {
      calculationResult = {
        type: 'flat',
        flatProcessingFee: 25.00,
      };
    }

    await engine.post(`/external-task/${task.id}/complete`, {
      workerId: WORKER_ID,
      variables: {
        calculationResult: { value: JSON.stringify(calculationResult), type: 'String' },
      },
    });

    console.log(`[CALCULATION] Task ${task.id} | category:${category} | result:${JSON.stringify(calculationResult)}`);
  } catch (err) {
    console.error(`[CALCULATION] Task ${task.id} failed:`, err.message);
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
        variables: ['extractedFields', 'category', 'interestRate', 'feePercent'],
      }],
    });
    const tasks = res.data;
    if (tasks.length === 0) return;
    await Promise.all(tasks.map(processTask));
  } catch (err) {
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(err.code)) {
      console.log('[CALCULATION] Engine not reachable, retrying...');
    } else {
      console.error('[CALCULATION] Poll error:', err.response?.data?.message || err.message);
    }
  }
}

let intervalId = null;

function start() {
  if (intervalId) return;
  console.log('[CALCULATION] Calculation worker started');
  intervalId = setInterval(poll, POLL_INTERVAL_MS);
}

function stop() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  console.log('[CALCULATION] Calculation worker stopped');
}

module.exports = { start, stop };
