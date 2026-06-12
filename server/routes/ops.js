const express = require('express');
const { handleFluxnovaError } = require('../services/fluxnova');
const axios = require('axios');

const router = express.Router();

function fluxnova() {
  return axios.create({
    baseURL: process.env.FLUXNOVA_URL,
    auth: {
      username: process.env.FLUXNOVA_USER,
      password: process.env.FLUXNOVA_PASS,
    },
  });
}

// Extract a flat variable map from history/variable-instance array
function extractVars(varArray) {
  return Object.fromEntries((varArray || []).map((v) => [v.name, v.value]));
}

// Camunda 7 rejects the UTC 'Z' suffix — it needs '+0000' instead
function toCamundaDate(date) {
  return date.toISOString().replace('Z', '+0000');
}

// ── GET /api/ops/stats ────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const engine = fluxnova();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = toCamundaDate(todayStart);

    const [pendingRes, completedRes, todayRes] = await Promise.all([
      engine.get('/task', {
        params: { candidateGroup: 'loanManagers' },
      }),
      engine.get('/history/process-instance', {
        params: { processDefinitionKey: 'loanApproval', finished: true },
      }),
      engine.get('/history/process-instance', {
        params: {
          processDefinitionKey: 'loanApproval',
          startedAfter: todayISO,
        },
      }),
    ]);

    const pending = Array.isArray(pendingRes.data) ? pendingRes.data.length : 0;
    const completedInstances = Array.isArray(completedRes.data) ? completedRes.data : [];
    const todayCount = Array.isArray(todayRes.data) ? todayRes.data.length : 0;

    // Fetch variables for each completed instance to determine approved/rejected
    const varResults = await Promise.allSettled(
      completedInstances.map((inst) =>
        engine.get('/history/variable-instance', {
          params: { processInstanceId: inst.id, variableName: 'approved' },
        })
      )
    );

    let approved = 0;
    let rejected = 0;
    let totalDuration = 0;
    let durationCount = 0;

    completedInstances.forEach((inst, i) => {
      const result = varResults[i];
      if (result.status === 'fulfilled') {
        const vars = extractVars(result.value.data);
        if (vars.approved === true) approved++;
        else if (vars.approved === false) rejected++;
      }
      if (inst.durationInMillis != null) {
        totalDuration += inst.durationInMillis;
        durationCount++;
      }
    });

    const avgDecisionTimeMs = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;
    const total = approved + rejected;
    const approvalRate = total > 0 ? Math.round((approved / total) * 1000) / 10 : 0;

    return res.json({ pending, approved, rejected, avgDecisionTimeMs, todayCount, approvalRate });
  } catch (err) {
    return handleFluxnovaError(err, res);
  }
});

// ── GET /api/ops/history ──────────────────────────────────────────────────────

router.get('/history', async (req, res) => {
  try {
    const engine = fluxnova();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(1, parseInt(req.query.pageSize, 10) || 10);
    const status = req.query.status || 'all';
    const { dateFrom, dateTo } = req.query;

    const params = {
      processDefinitionKey: 'loanApproval',
      firstResult: (page - 1) * pageSize,
      maxResults: pageSize,
      sortBy: 'startTime',
      sortOrder: 'desc',
    };

    if (status !== 'pending') params.finished = true;
    if (dateFrom) params.startedAfter = toCamundaDate(new Date(dateFrom));
    if (dateTo) params.startedBefore = toCamundaDate(new Date(dateTo));

    // Fetch count separately
    const [listRes, countRes] = await Promise.all([
      engine.get('/history/process-instance', { params }),
      engine.get('/history/process-instance', {
        params: { ...params, firstResult: undefined, maxResults: undefined, count: true },
      }),
    ]);

    const instances = Array.isArray(listRes.data) ? listRes.data : [];
    const total = typeof countRes.data === 'number'
      ? countRes.data
      : (countRes.data?.count ?? instances.length);

    // Fetch variables for each instance in parallel
    const varResults = await Promise.allSettled(
      instances.map((inst) =>
        engine.get('/history/variable-instance', {
          params: { processInstanceId: inst.id },
        })
      )
    );

    const items = instances.map((inst, i) => {
      const result = varResults[i];
      const vars = result.status === 'fulfilled' ? extractVars(result.value.data) : {};

      // Apply client-side status filter when filtering by approved/rejected
      return {
        instanceId: inst.id,
        applicantName: [vars.applicantFirstName, vars.applicantLastName].filter(Boolean).join(' ') || '—',
        loanAmount: vars.loanAmount ?? null,
        termMonths: vars.termMonths ?? null,
        loanPurpose: vars.loanPurpose ?? null,
        creditScore: vars.creditScore ?? null,
        rateTier: vars.rateTier ?? null,
        interestRate: vars.interestRate ?? null,
        approved: vars.approved ?? null,
        reviewNote: vars.reviewNote ?? null,
        startTime: inst.startTime,
        endTime: inst.endTime,
        durationInMillis: inst.durationInMillis ?? null,
      };
    }).filter((item) => {
      if (status === 'approved') return item.approved === true;
      if (status === 'rejected') return item.approved === false;
      return true;
    });

    return res.json({ total, page, pageSize, items });
  } catch (err) {
    return handleFluxnovaError(err, res);
  }
});

module.exports = router;
