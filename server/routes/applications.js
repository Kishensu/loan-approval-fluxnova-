const express = require('express');
const {
  startProcess,
  getProcessStatus,
  getActiveTask,
  getProcessVariables,
  handleFluxnovaError,
} = require('../services/fluxnova');

const router = express.Router();

const TASK_STEP_MAP = {
  submitApplication: 'apply',
  creditCheck: 'credit_check',
  rateDecision: 'rate_decision',
  managerReview: 'review',
};

const REQUIRED_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'annualIncome',
  'employmentStatus',
  'loanAmount',
  'termMonths',
  'loanPurpose',
];

router.post('/', async (req, res) => {
  const {
    firstName, lastName, email, phone,
    annualIncome, employmentStatus, monthlyExpenses,
    loanAmount, termMonths, loanPurpose, notes,
  } = req.body;

  const missing = REQUIRED_FIELDS.filter((f) => req.body[f] == null || req.body[f] === '');
  if (missing.length) {
    return res.status(400).json({ error: 'Missing required fields', fields: missing });
  }

  try {
    const result = await startProcess({
      applicantFirstName: firstName,
      applicantLastName: lastName,
      applicantEmail: email,
      applicantPhone: phone || '',
      annualIncome: Math.round(Number(annualIncome)),
      loanAmount: Math.round(Number(loanAmount)),
      termMonths: parseInt(termMonths, 10),
      loanPurpose,
      employmentStatus,
      notes: notes || '',
    });
    return res.status(201).json({ instanceId: result.id, message: 'Application filed' });
  } catch (err) {
    return handleFluxnovaError(err, res);
  }
});

router.get('/:instanceId/status', async (req, res) => {
  const { instanceId } = req.params;

  try {
    const [processStatus, activeTask, rawVars] = await Promise.all([
      getProcessStatus(instanceId),
      getActiveTask(instanceId),
      getProcessVariables(instanceId),
    ]);

    const isCompleted = processStatus.state === 'COMPLETED';
    const currentTask = activeTask
      ? (TASK_STEP_MAP[activeTask.taskDefinitionKey] || activeTask.taskDefinitionKey)
      : 'decision';

    return res.json({
      instanceId,
      status: isCompleted ? 'completed' : 'active',
      currentTask,
      variables: {
        applicantFirstName: rawVars.applicantFirstName ?? null,
        applicantLastName: rawVars.applicantLastName ?? null,
        loanAmount: rawVars.loanAmount ?? null,
        termMonths: rawVars.termMonths ?? null,
        loanPurpose: rawVars.loanPurpose ?? null,
        annualIncome: rawVars.annualIncome ?? null,
        rateTier: rawVars.rateTier ?? null,
        interestRate: rawVars.interestRate ?? null,
        approved: rawVars.approved ?? null,
        creditScore: rawVars.creditScore ?? null,
        rateResult: rawVars.rateResult ?? null,
      },
    });
  } catch (err) {
    return handleFluxnovaError(err, res);
  }
});

module.exports = router;
