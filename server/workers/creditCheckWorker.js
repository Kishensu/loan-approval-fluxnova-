require('dotenv').config();
const axios = require('axios');

const ENGINE = process.env.FLUXNOVA_URL || 'http://localhost:8080/engine-rest';
const WORKER_ID = 'credit-check-worker-1';
const TOPIC = 'credit-check';
const POLL_INTERVAL_MS = 3000;
const LOCK_DURATION_MS = 10000;

const engine = axios.create({
  baseURL: ENGINE,
  auth: {
    username: process.env.FLUXNOVA_USER || 'demo',
    password: process.env.FLUXNOVA_PASS || 'demo',
  },
});

function calcCreditScore(annualIncome, loanAmount) {
  const base = Math.floor(Math.random() * (820 - 580 + 1)) + 580;
  let score = base;
  if (Number(annualIncome) > 100000) score += 30;
  if (Number(loanAmount) < 10000) score += 20;
  return Math.round(Math.min(850, Math.max(300, score)));
}

async function processTask(task) {
  const vars = task.variables || {};
  const firstName = vars.applicantFirstName?.value ?? '';
  const lastName = vars.applicantLastName?.value ?? '';
  const annualIncome = vars.annualIncome?.value ?? 0;
  const loanAmount = vars.loanAmount?.value ?? 0;

  const score = calcCreditScore(annualIncome, loanAmount);

  try {
    await engine.post(`/external-task/${task.id}/complete`, {
      workerId: WORKER_ID,
      variables: {
        creditScore: { value: score, type: 'Integer' },
      },
    });
    console.log(`[CREDIT CHECK] Task ${task.id} | Applicant: ${firstName} ${lastName} | Score: ${score}`);
  } catch (err) {
    console.error(`[CREDIT CHECK] Failed to complete task ${task.id}:`, err.response?.data?.message || err.message);
  }
}

async function poll() {
  try {
    const res = await engine.post('/external-task/fetchAndLock', {
      workerId: WORKER_ID,
      maxTasks: 10,
      usePriority: false,
      topics: [
        {
          topicName: TOPIC,
          lockDuration: LOCK_DURATION_MS,
          variables: ['applicantFirstName', 'applicantLastName', 'annualIncome', 'loanAmount'],
        },
      ],
    });

    const tasks = res.data;
    if (tasks.length === 0) return;

    await Promise.all(tasks.map(processTask));
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
      console.log('[CREDIT CHECK] Fluxnova not reachable, retrying...');
    } else {
      console.error('[CREDIT CHECK] Poll error:', err.response?.data?.message || err.message);
    }
  }
}

let intervalId = null;

function start() {
  if (intervalId) return;
  console.log('[CREDIT CHECK] Credit check worker started');
  intervalId = setInterval(poll, POLL_INTERVAL_MS);
}

function stop() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  console.log('[CREDIT CHECK] Credit check worker stopped');
}

module.exports = { start, stop };
