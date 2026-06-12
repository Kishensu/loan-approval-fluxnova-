require('dotenv').config();
const express = require('express');
const cors = require('cors');

const applicationsRouter = require('./routes/applications');
const tasksRouter = require('./routes/tasks');
const opsRouter = require('./routes/ops');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

app.use('/api/applications', applicationsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/ops', opsRouter);

// Global error handler — catches any unhandled throws (Express 5 auto-catches async errors)
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[Unhandled error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on :${PORT}`);
  console.log(`Fluxnova engine: ${process.env.FLUXNOVA_URL}`);

  const creditCheckWorker = require('./workers/creditCheckWorker');
  creditCheckWorker.start();
});

/*
 * ── Test commands ────────────────────────────────────────────────────────────
 *
 * Health check (should return 404 JSON, not HTML):
 *   curl http://localhost:3001/api/applications
 *
 * Start a process:
 *   curl -X POST http://localhost:3001/api/applications \
 *     -H "Content-Type: application/json" \
 *     -d '{"firstName":"Jordan","lastName":"Smith","email":"jordan@example.com",
 *          "annualIncome":85000,"employmentStatus":"full_time",
 *          "loanAmount":25000,"termMonths":36,"loanPurpose":"vehicle"}'
 *
 * Check status (replace INSTANCE_ID):
 *   curl http://localhost:3001/api/applications/INSTANCE_ID/status
 *
 * Get manager tasks:
 *   curl http://localhost:3001/api/tasks
 *
 * Complete a task (replace TASK_ID):
 *   curl -X POST http://localhost:3001/api/tasks/TASK_ID/complete \
 *     -H "Content-Type: application/json" \
 *     -d '{"approved":true,"reviewNote":"Looks good"}'
 * ─────────────────────────────────────────────────────────────────────────────
 */
