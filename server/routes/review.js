const express = require('express');
const axios = require('axios');

const router = express.Router();

const ENGINE_URL = process.env.FLUXNOVA_URL || 'http://localhost:8080/engine-rest';
const ENGINE_AUTH = {
  username: process.env.FLUXNOVA_USER || 'demo',
  password: process.env.FLUXNOVA_PASS || 'demo',
};

const fluxnova = axios.create({ baseURL: ENGINE_URL, auth: ENGINE_AUTH });

// GET /api/review/tasks — list open manual-field-review tasks enriched with variables
router.get('/tasks', async (req, res) => {
  try {
    const taskRes = await fluxnova.get('/task', {
      params: {
        taskDefinitionKey: 'manual-field-review',
        candidateGroup: 'form-review',
        sortBy: 'created',
        sortOrder: 'asc',
      },
    });

    const enriched = await Promise.all(
      taskRes.data.map(async (task) => {
        try {
          const varRes = await fluxnova.get('/history/variable-instance', {
            params: { processInstanceId: task.processInstanceId },
          });
          const vars = Object.fromEntries(varRes.data.map((v) => [v.name, v.value]));

          let extractedFields = {};
          let lowConfidenceFields = [];
          try { extractedFields = JSON.parse(vars.extractedFields || '{}'); } catch {}
          try { lowConfidenceFields = JSON.parse(vars.lowConfidenceFields || '[]'); } catch {}

          return {
            taskId: task.id,
            processInstanceId: task.processInstanceId,
            created: task.created,
            documentId: vars.documentId || null,
            originalFilename: vars.originalFilename || null,
            extractedFields,
            lowConfidenceFields,
          };
        } catch {
          return {
            taskId: task.id,
            processInstanceId: task.processInstanceId,
            created: task.created,
            documentId: null,
            originalFilename: null,
            extractedFields: {},
            lowConfidenceFields: [],
          };
        }
      })
    );

    return res.json(enriched);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') return res.status(503).json({ error: 'Engine not reachable' });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/review/tasks/:taskId/complete — submit corrected field values
router.post('/tasks/:taskId/complete', async (req, res) => {
  const { taskId } = req.params;
  const { fields } = req.body;

  if (!fields || typeof fields !== 'object') {
    return res.status(400).json({ error: 'Request body must contain a "fields" object' });
  }

  // Rebuild extractedFields with reviewed values; set confidence to 1.0 on all corrected fields
  const reviewedExtractedFields = Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [name, { value, confidence: 1.0 }])
  );

  const variables = {
    extractedFields: { value: JSON.stringify(reviewedExtractedFields), type: 'String' },
    reviewedBy: { value: 'demo', type: 'String' },
  };

  // Also update top-level scalar vars so the DMN receives corrected values
  if (fields.requestType !== undefined)
    variables.requestType = { value: String(fields.requestType), type: 'String' };
  if (fields.amount !== undefined)
    variables.amount = { value: Number(fields.amount) || 0, type: 'Double' };
  if (fields.applicantName !== undefined)
    variables.applicantName = { value: String(fields.applicantName), type: 'String' };
  if (fields.requestDate !== undefined)
    variables.requestDate = { value: String(fields.requestDate), type: 'String' };
  if (fields.description !== undefined)
    variables.description = { value: String(fields.description), type: 'String' };

  try {
    await fluxnova.post(`/task/${taskId}/complete`, { variables });
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') return res.status(503).json({ error: 'Engine not reachable' });
    const status = err.response?.status || 500;
    return res.status(status).json({ error: err.response?.data?.message || err.message });
  }
});

module.exports = router;
