const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const axios = require('axios');

const router = express.Router();

const ENGINE_URL = process.env.FLUXNOVA_URL || 'http://localhost:8080/engine-rest';
const ENGINE_AUTH = {
  username: process.env.FLUXNOVA_USER || 'demo',
  password: process.env.FLUXNOVA_PASS || 'demo',
};

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, randomUUID() + ext);
  },
});

const upload = multer({
  storage,
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

  const documentId = req.file.filename; // uuid + original extension
  const originalFilename = req.file.originalname;

  try {
    const result = await fluxnova.post(
      '/process-definition/key/intelligent-form-processing/start',
      {
        variables: {
          documentId:       { value: documentId,       type: 'String' },
          originalFilename: { value: originalFilename, type: 'String' },
        },
      }
    );
    return res.status(201).json({ processInstanceId: result.data.id, documentId });
  } catch (err) {
    fs.unlink(path.join(UPLOADS_DIR, documentId), () => {});
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ error: 'FluxNova engine not reachable' });
    }
    const status = err.response?.status || 500;
    return res.status(status).json({ error: err.response?.data?.message || err.message });
  }
});

// GET /api/forms/status/:processInstanceId — derive pipeline stage from engine state
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

    // Derive stage
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

// GET /api/forms/document/:documentId — serve the uploaded file for display
router.get('/document/:documentId', (req, res) => {
  const { documentId } = req.params;
  const filePath = path.join(UPLOADS_DIR, documentId);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Document not found' });
  return res.sendFile(filePath);
});

module.exports = router;
