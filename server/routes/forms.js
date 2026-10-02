const express = require('express');
const multer = require('multer');
const path = require('path');
const { randomUUID } = require('crypto');
const axios = require('axios');

const router = express.Router();

const ENGINE_URL = process.env.FLUXNOVA_URL || 'http://localhost:8080/engine-rest';
const ENGINE_AUTH = {
  username: process.env.FLUXNOVA_USER || 'demo',
  password: process.env.FLUXNOVA_PASS || 'demo',
};

// Memory storage — no disk dependency (Railway containers are ephemeral)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype);
    cb(null, ok);
  },
});

const fluxnova = axios.create({ baseURL: ENGINE_URL, auth: ENGINE_AUTH });

// POST /api/forms/upload — receive multipart file, start IFP process instance
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided or unsupported type (jpg/png/pdf only)' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
  const documentId = randomUUID() + ext;
  const originalFilename = req.file.originalname;
  const documentBase64 = req.file.buffer.toString('base64');
  const documentMimeType = req.file.mimetype;

  console.log(`[UPLOAD] ${documentId} (${req.file.size} bytes, ${documentMimeType})`);

  try {
    const result = await fluxnova.post(
      '/process-definition/key/intelligent-form-processing/start',
      {
        variables: {
          documentId:       { value: documentId,       type: 'String' },
          originalFilename: { value: originalFilename, type: 'String' },
          documentBase64:   { value: documentBase64,   type: 'Bytes'  },
          documentMimeType: { value: documentMimeType, type: 'String' },
        },
      }
    );
    return res.status(201).json({ processInstanceId: result.data.id, documentId });
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ error: 'FluxNova engine not reachable' });
    }
    const status = err.response?.status || 500;
    return res.status(status).json({ error: err.response?.data?.message || err.message });
  }
});

// GET /api/forms/status/:processInstanceId
router.get('/status/:processInstanceId', async (req, res) => {
  const { processInstanceId } = req.params;

  try {
    const [histResult, taskResult, varResult] = await Promise.allSettled([
      fluxnova.get(`/history/process-instance/${processInstanceId}`),
      fluxnova.get('/task', { params: { processInstanceId, taskDefinitionKey: 'manual-field-review' } }),
      fluxnova.get('/history/variable-instance', { params: { processInstanceId } }),
    ]);

    if (histResult.status === 'rejected') {
      const e = histResult.reason;
      if (e.response?.status === 404) return res.status(404).json({ error: 'Process instance not found' });
      return res.status(502).json({ error: 'Engine error' });
    }

    const hist = histResult.value.data;
    const tasks = taskResult.status === 'fulfilled' ? taskResult.value.data : [];
    const rawVars = varResult.status === 'fulfilled'
      ? Object.fromEntries(varResult.value.data.map((v) => [v.name, v.value]))
      : {};

    let stage;
    if (hist.state === 'COMPLETED') {
      stage = 'completed';
    } else if (tasks.length > 0) {
      stage = 'review';
    } else if (rawVars.extractedFields) {
      stage = 'triage/calculating';
    } else {
      stage = 'extracting';
    }

    let calculationResult = null;
    if (rawVars.calculationResult) {
      try { calculationResult = JSON.parse(rawVars.calculationResult); } catch {}
    }

    return res.json({
      processInstanceId,
      stage,
      state: hist.state,
      startTime: hist.startTime,
      endTime: hist.endTime,
      variables: {
        documentId:       rawVars.documentId       ?? null,
        originalFilename: rawVars.originalFilename ?? null,
        applicantName:    rawVars.applicantName    ?? null,
        requestType:      rawVars.requestType      ?? null,
        amount:           rawVars.amount           ?? null,
        needsReview:      rawVars.needsReview      ?? null,
        category:         rawVars.category         ?? null,
        priority:         rawVars.priority         ?? null,
        calculationResult,
      },
    });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') return res.status(503).json({ error: 'Engine not reachable' });
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/forms/document/:processInstanceId — fetch image from Camunda variables
router.get('/document/:processInstanceId', async (req, res) => {
  const { processInstanceId } = req.params;
  try {
    const varRes = await fluxnova.get('/history/variable-instance', {
      params: { processInstanceId, variableName: 'documentBase64' },
    });
    const mimeRes = await fluxnova.get('/history/variable-instance', {
      params: { processInstanceId, variableName: 'documentMimeType' },
    });

    const b64 = varRes.data?.[0]?.value;
    const mime = mimeRes.data?.[0]?.value || 'image/png';

    if (!b64) return res.status(404).json({ error: 'Document not found' });

    const buf = Buffer.from(b64, 'base64');
    res.set('Content-Type', mime);
    res.set('Content-Length', buf.length);
    return res.send(buf);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
