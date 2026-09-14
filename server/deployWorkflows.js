require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const ENGINE = process.env.FLUXNOVA_URL || 'http://localhost:8080/engine-rest';
const auth = {
  username: process.env.FLUXNOVA_USER || 'demo',
  password: process.env.FLUXNOVA_PASS || 'demo',
};

async function isDeployed(key) {
  try {
    const res = await axios.get(`${ENGINE}/process-definition?key=${key}`, { auth });
    return res.data.length > 0;
  } catch {
    return false;
  }
}

async function deploy(deploymentName, files) {
  const fd = new FormData();
  fd.append('deployment-name', deploymentName);
  fd.append('deploy-changed-only', 'true');
  for (const [name, filePath] of Object.entries(files)) {
    fd.append(name, fs.createReadStream(filePath));
  }
  await axios.post(`${ENGINE}/deployment/create`, fd, {
    auth,
    headers: fd.getHeaders(),
  });
  console.log(`[DEPLOY] "${deploymentName}" deployed.`);
}

async function deployWorkflows() {
  const processDir   = path.join(__dirname, 'process');
  const workflowsDir = path.join(__dirname, 'workflows');

  // Retry up to 12 times (2 min) waiting for Camunda to be ready
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      await axios.get(`${ENGINE}/engine`, { auth, timeout: 5000 });
      break;
    } catch {
      if (attempt === 12) {
        console.error('[DEPLOY] Camunda not reachable after 2 min — skipping deployment.');
        return;
      }
      console.log(`[DEPLOY] Waiting for Camunda… (attempt ${attempt}/12)`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  if (!await isDeployed('loan-approval')) {
    await deploy('loan-approval', {
      'loan-approval.bpmn':        path.join(processDir, 'bpmn', 'loan-approval.bpmn'),
      'loan-rate-decision.dmn':    path.join(processDir, 'dmn',  'loan-rate-decision.dmn'),
    });
  } else {
    console.log('[DEPLOY] loan-approval already deployed.');
  }

  if (!await isDeployed('intelligent-form-processing')) {
    await deploy('intelligent-form-processing', {
      'intelligent-form-processing.bpmn': path.join(workflowsDir, 'intelligent-form-processing.bpmn'),
      'triage-request.dmn':               path.join(workflowsDir, 'triage-request.dmn'),
    });
  } else {
    console.log('[DEPLOY] intelligent-form-processing already deployed.');
  }
}

module.exports = { deployWorkflows };
