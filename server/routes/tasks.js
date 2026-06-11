const express = require('express');
const {
  getManagerTasks,
  getProcessVariables,
  claimTask,
  completeTask,
  handleFluxnovaError,
} = require('../services/fluxnova');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const tasks = await getManagerTasks();

    const enriched = await Promise.all(
      tasks.map(async (task) => {
        let variables = {};
        try {
          const raw = await getProcessVariables(task.processInstanceId);
          variables = {
            applicantFirstName: raw.applicantFirstName ?? null,
            applicantLastName: raw.applicantLastName ?? null,
            loanAmount: raw.loanAmount ?? null,
            termMonths: raw.termMonths ?? null,
            loanPurpose: raw.loanPurpose ?? null,
            annualIncome: raw.annualIncome ?? null,
            rateTier: raw.rateTier ?? null,
            interestRate: raw.interestRate ?? null,
            creditScore: raw.creditScore ?? null,
            rateResult: raw.rateResult ?? null,
          };
        } catch {
          // Partial failure: return task without variables rather than killing the whole list
        }
        return {
          id: task.id,
          name: task.name,
          created: task.created,
          processInstanceId: task.processInstanceId,
          variables,
        };
      })
    );

    return res.json(enriched);
  } catch (err) {
    return handleFluxnovaError(err, res);
  }
});

router.post('/:taskId/claim', async (req, res) => {
  const { taskId } = req.params;
  const { userId } = req.body;
  try {
    await claimTask(taskId, userId);
    return res.json({ message: 'Task claimed' });
  } catch (err) {
    return handleFluxnovaError(err, res);
  }
});

router.post('/:taskId/complete', async (req, res) => {
  const { taskId } = req.params;
  const { approved, reviewNote } = req.body;
  if (approved == null) {
    return res.status(400).json({ error: 'approved (boolean) is required' });
  }
  try {
    await completeTask(taskId, { approved: Boolean(approved), reviewNote });
    return res.json({ message: 'Review complete' });
  } catch (err) {
    return handleFluxnovaError(err, res);
  }
});

module.exports = router;
