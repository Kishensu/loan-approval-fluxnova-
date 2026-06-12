const axios = require('axios');
const fs = require('fs');
const path = require('path');

const fluxnova = axios.create({
  baseURL: process.env.FLUXNOVA_URL,
  auth: {
    username: process.env.FLUXNOVA_USER,
    password: process.env.FLUXNOVA_PASS,
  },
});

const VARIABLE_TYPES = {
  applicantFirstName: 'String',
  applicantLastName: 'String',
  applicantEmail: 'String',
  applicantPhone: 'String',
  annualIncome: 'Long',
  loanAmount: 'Long',
  termMonths: 'Integer',
  loanPurpose: 'String',
  employmentStatus: 'String',
  notes: 'String',
};

function toFluxnovaVariables(vars) {
  return Object.fromEntries(
    Object.entries(vars)
      .filter(([k, v]) => v != null && VARIABLE_TYPES[k])
      .map(([k, v]) => [k, { value: v, type: VARIABLE_TYPES[k] }])
  );
}

async function startProcess(variables) {
  const res = await fluxnova.post('/process-definition/key/loanApproval/start', {
    variables: toFluxnovaVariables(variables),
  });
  return res.data;
}

async function getProcessVariables(instanceId) {
  // Use the history API so this works for both active and completed instances.
  // The live /process-instance/{id}/variables endpoint returns 500 once an
  // execution has ended ("execution is null").
  const res = await fluxnova.get('/history/variable-instance', {
    params: { processInstanceId: instanceId },
  });
  return Object.fromEntries(res.data.map((v) => [v.name, v.value]));
}

async function getActiveTask(instanceId) {
  const res = await fluxnova.get('/task', {
    params: { processInstanceId: instanceId },
  });
  return res.data.length > 0 ? res.data[0] : null;
}

async function getProcessStatus(instanceId) {
  const res = await fluxnova.get(`/history/process-instance/${instanceId}`);
  const { state, startTime, endTime } = res.data;
  return { state, startTime, endTime };
}

async function getManagerTasks() {
  const res = await fluxnova.get('/task', {
    params: {
      candidateGroup: 'loanManagers',
      sortBy: 'created',
      sortOrder: 'asc',
    },
  });
  return res.data;
}

async function claimTask(taskId, userId) {
  const res = await fluxnova.post(`/task/${taskId}/claim`, { userId });
  return res.data;
}

async function completeTask(taskId, variables) {
  const { approved, reviewNote } = variables;
  const res = await fluxnova.post(`/task/${taskId}/complete`, {
    variables: {
      approved: { value: approved, type: 'Boolean' },
      reviewNote: { value: reviewNote || '', type: 'String' },
    },
  });
  return res.data;
}

async function deployProcess(filePath) {
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath);
  const boundary = '----FluxnovaBoundary' + Date.now().toString(36);

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="deployment-name"\r\n\r\n${fileName}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="data"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    fileContent,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await fluxnova.post('/deployment/create', body, {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
  });
  return res.data;
}

function handleFluxnovaError(err, res) {
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      error: 'Fluxnova engine is not reachable. Is Docker running?',
    });
  }
  if (err.response) {
    const { status, data } = err.response;
    console.error('[Fluxnova]', status, JSON.stringify(data));
    if (status === 404) return res.status(404).json({ error: 'Process or task not found' });
    if (status === 400) return res.status(400).json({ error: data?.message || 'Bad request' });
    return res.status(502).json({ error: data?.message || 'Fluxnova error' });
  }
  console.error('[Error]', err.message);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = {
  startProcess,
  getProcessVariables,
  getActiveTask,
  getProcessStatus,
  getManagerTasks,
  claimTask,
  completeTask,
  deployProcess,
  handleFluxnovaError,
};
