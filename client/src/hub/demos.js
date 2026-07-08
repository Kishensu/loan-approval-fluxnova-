export const DEMOS = [
  {
    id: 'loan-approval',
    title: 'AI-Powered Loan Approval',
    description:
      'An end-to-end automated loan pipeline combining credit scoring, DMN-driven rate decisions, and human-in-the-loop manager review — fully orchestrated by FluxNova.',
    tags: ['AI', 'BPM', 'LSS', 'Finance'],
    status: 'live',
    route: '/hub/demos/loan-approval',
    thumbnail: null,
    highlights: [
      'FluxNova BPMN orchestration',
      'DMN decision tables for rate tiers',
      'Human-in-the-loop manager review',
      'External task worker pattern (credit check)',
      'Real-time process status polling',
    ],
    techStack: ['FluxNova', 'React 19', 'Node.js / Express 5', 'DMN', 'Axios'],
    flowSteps: [
      { label: 'Application\nSubmit', icon: '📝' },
      { label: 'Credit\nCheck', icon: '🤖' },
      { label: 'Rate\nDecision', icon: '📊' },
      { label: 'Manager\nReview', icon: '👤' },
      { label: 'Decision', icon: '✅' },
    ],
    liveRoute: '/apply',
  },
  {
    id: 'ai-document-analysis',
    title: 'AI Document Analysis',
    description:
      'Upload a scanned application or pay stub — Hugging Face Donut / LayoutLM extracts structured fields automatically and populates a FluxNova process.',
    tags: ['AI', 'OCR', 'BPM', 'Finance'],
    status: 'coming-soon',
    route: '/hub/demos/ai-document-analysis',
    thumbnail: null,
    highlights: [
      'Donut / LayoutLM zero-shot OCR',
      'Automatic field extraction to process variables',
      'Confidence scoring with human fallback',
    ],
    techStack: ['FluxNova', 'Hugging Face', 'Python FastAPI', 'React'],
    flowSteps: [
      { label: 'Upload\nDocument', icon: '📄' },
      { label: 'OCR\nExtract', icon: '🔍' },
      { label: 'Field\nValidate', icon: '✔️' },
      { label: 'Process\nStart', icon: '⚙️' },
    ],
    liveRoute: null,
  },
  {
    id: 'voice-to-application',
    title: 'Voice-to-Application',
    description:
      'Speak your loan details — OpenAI Whisper transcribes speech, an LLM extracts structured fields, and FluxNova launches the approval workflow automatically.',
    tags: ['AI', 'BPM', 'Finance'],
    status: 'coming-soon',
    route: '/hub/demos/voice-to-application',
    thumbnail: null,
    highlights: [
      'Whisper ASR transcription',
      'LLM field extraction (GPT-4o / Claude)',
      'One-click to FluxNova process',
    ],
    techStack: ['Whisper', 'OpenAI API', 'FluxNova', 'React'],
    flowSteps: [
      { label: 'Voice\nRecord', icon: '🎙️' },
      { label: 'Transcribe\n(Whisper)', icon: '🔊' },
      { label: 'Extract\nFields', icon: '🧠' },
      { label: 'Submit\nProcess', icon: '🚀' },
    ],
    liveRoute: null,
  },
  {
    id: 'fraud-detection',
    title: 'Fraud Detection Agent',
    description:
      'An ML anomaly-detection agent scores every application for fraud risk in real time. High-risk submissions trigger a parallel review branch in FluxNova.',
    tags: ['AI', 'BPM', 'Finance', 'LSS'],
    status: 'coming-soon',
    route: '/hub/demos/fraud-detection',
    thumbnail: null,
    highlights: [
      'Isolation Forest / AutoEncoder anomaly scoring',
      'Parallel BPMN gateway for risk escalation',
      'Explainable risk features (SHAP)',
    ],
    techStack: ['scikit-learn', 'FluxNova', 'Python', 'React'],
    flowSteps: [
      { label: 'Application\nData', icon: '📋' },
      { label: 'Feature\nExtraction', icon: '⚙️' },
      { label: 'ML\nScore', icon: '🤖' },
      { label: 'Risk\nGateway', icon: '⚡' },
      { label: 'Review /\nApprove', icon: '🛡️' },
    ],
    liveRoute: null,
  },
  {
    id: 'explainable-ai',
    title: 'Explainable AI Decisions',
    description:
      'Every AI-driven decision comes with a SHAP waterfall chart showing exactly which factors drove the outcome — making FluxNova decisions auditable and transparent.',
    tags: ['AI', 'LSS', 'Finance'],
    status: 'coming-soon',
    route: '/hub/demos/explainable-ai',
    thumbnail: null,
    highlights: [
      'SHAP values for every model prediction',
      'Interactive waterfall + force plots',
      'Stored as process variables in FluxNova history',
    ],
    techStack: ['SHAP', 'scikit-learn', 'FluxNova', 'React', 'D3'],
    flowSteps: [
      { label: 'Input\nFeatures', icon: '📊' },
      { label: 'ML\nPredict', icon: '🧠' },
      { label: 'SHAP\nValues', icon: '📈' },
      { label: 'Visual\nReport', icon: '🖼️' },
      { label: 'Auditable\nDecision', icon: '📜' },
    ],
    liveRoute: null,
  },
  {
    id: 'ncr-capa',
    title: 'NCR / CAPA Workflow',
    description:
      'A Lean Six Sigma quality management flow — non-conformances are logged, root-caused, corrective actions assigned, and effectiveness verified through FluxNova.',
    tags: ['LSS', 'BPM', 'Quality'],
    status: 'coming-soon',
    route: '/hub/demos/ncr-capa',
    thumbnail: null,
    highlights: [
      'BPMN-modeled NCR lifecycle',
      'Fishbone / 5-Why root cause capture',
      'CAPA effectiveness verification loop',
    ],
    techStack: ['FluxNova', 'React', 'Node.js'],
    flowSteps: [
      { label: 'Detect\nDefect', icon: '🚨' },
      { label: 'Log\nNCR', icon: '📝' },
      { label: 'Root\nCause', icon: '🔍' },
      { label: 'CAPA\nPlan', icon: '📋' },
      { label: 'Verify\n& Close', icon: '✅' },
    ],
    liveRoute: null,
  },
  {
    id: 'employee-onboarding',
    title: 'Employee Onboarding Automation',
    description:
      'Multi-department parallel onboarding: IT provisioning, HR documentation, manager introductions, and training assignments — all synchronized by FluxNova.',
    tags: ['BPM', 'LSS', 'HR'],
    status: 'coming-soon',
    route: '/hub/demos/employee-onboarding',
    thumbnail: null,
    highlights: [
      'Parallel BPMN gateways across departments',
      'SLA timers with escalation',
      'Role-based task assignment',
    ],
    techStack: ['FluxNova', 'React', 'Node.js', 'BPMN 2.0'],
    flowSteps: [
      { label: 'Offer\nAccepted', icon: '🤝' },
      { label: 'IT +\nHR (parallel)', icon: '⚙️' },
      { label: 'Manager\nIntro', icon: '👋' },
      { label: 'Training\nAssign', icon: '📚' },
      { label: 'Access\nGranted', icon: '🔑' },
    ],
    liveRoute: null,
  },
];

export const ALL_TAGS = [...new Set(DEMOS.flatMap((d) => d.tags))].sort();

export function getDemoById(id) {
  return DEMOS.find((d) => d.id === id) || null;
}

export function getRelatedDemos(demo, count = 3) {
  return DEMOS.filter(
    (d) => d.id !== demo.id && d.tags.some((t) => demo.tags.includes(t))
  ).slice(0, count);
}
