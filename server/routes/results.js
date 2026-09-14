const express = require('express');
const resultStore = require('../store/results');

const router = express.Router();

// GET /api/results
router.get('/', (req, res) => {
  try {
    return res.json(resultStore.list());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/results/:processInstanceId
router.get('/:processInstanceId', (req, res) => {
  const record = resultStore.get(req.params.processInstanceId);
  if (!record) return res.status(404).json({ error: 'Result not found' });
  return res.json(record);
});

module.exports = router;
