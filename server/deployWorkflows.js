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
  // Verify all files exist before building the form
  for (const [fieldName, filePath] of Object.entries(files)) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Resource file not found: ${filePath} (field: ${fieldName})`);
    }
    console.log(`[DEPLOY] Found ${fieldName} at ${filePath} (${fs.statSync(filePath).size} bytes)`);
  }

  const fd = new FormData();
  fd.append('deployment-name', deploymentName);
  fd.append('deploy-changed-only', 'true');
  for (const [fieldName, filePath] of Object.entries(files)) {
    fd.append(fieldName, fs.createReadStream(filePath));
  }

  try {
    await axios.post(`${ENGINE}/deployment/create`, fd, {
      auth,
      headers: fd.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    console.log(`[DEPLOY] "${deploymentName}" deployed successfully.`);
  } catch (err) {
    const detail = JSON.stringify(err.response?.data) || err.message;
    throw new Error(`Camunda rejected "${deploymentName}" (${err.response?.status}): ${detail}`);
  }
}

async function deployWorkflows() {
  const processDir   = path.join(__dirname, 'process');
  const workflowsDir = path.join(__dirname, 'workflows');

  console.log(`[DEPLOY] processDir: ${processDir} exists=${fs.existsSync(processDir)}`);
  console.log(`[DEPLOY] workflowsDir: ${workflowsDir} exists=${fs.existsSync(workflowsDir)}`);

  // Wait for Camunda to be ready (up to 2 min)
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      await axios.get(`${ENGINE}/engine`, { auth, timeout: 5000 });
      console.log('[DEPLOY] Camunda is ready.');
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

  const deployments = [
    ['loan-approval', {
      'loan-approval.bpmn':     path.join(processDir, 'bpmn', 'loan-approval.bpmn'),
      'loan-rate-decision.dmn': path.join(processDir, 'dmn',  'loan-rate-decision.dmn'),
    }],
    // Triage logic moved to triageWorker.js (external task) — no DMN needed
    ['intelligent-form-processing', {
      'intelligent-form-processing.bpmn': path.join(workflowsDir, 'intelligent-form-processing.bpmn'),
    }],
  ];

  for (const [name, files] of deployments) {
    try {
      if (await isDeployed(name)) {
        console.log(`[DEPLOY] "${name}" already deployed — skipping.`);
      } else {
        await deploy(name, files);
      }
    } catch (err) {
      console.error(`[DEPLOY] ERROR deploying "${name}": ${err.message}`);
    }
  }
}

module.exports = { deployWorkflows };
