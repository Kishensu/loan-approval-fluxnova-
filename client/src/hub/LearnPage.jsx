import { useState } from 'react';

// ── Tab 1 data: FluxNova components ──────────────────────────────────────────

const COMPONENTS = [
  {
    icon: '⚙️',
    name: 'BPM Engine',
    tagline: 'Executes BPMN 2.0 process definitions',
    body: 'The core orchestration engine interprets BPMN XML and manages every active process instance. It tracks state, evaluates sequence flow conditions, triggers timers, and coordinates tasks — all durably stored so nothing is lost on restart.',
    lss: 'LSS fit: The engine is your control plan made executable. It ensures the defined process is the actual process — eliminating the "work-as-imagined vs work-as-done" gap that Lean audits routinely find.',
  },
  {
    icon: '📊',
    name: 'Cockpit',
    tagline: 'Process monitoring and incident management',
    body: 'Cockpit is the operational dashboard for running processes. You can inspect variables, resolve incidents (e.g., a failed service call), migrate instances between process versions, and drill into audit trails.',
    lss: 'LSS fit: Cockpit gives you real-time process visibility — the foundation of Measure and Control phases. Cycle time, WIP count, and incident rates are all observable without custom instrumentation.',
  },
  {
    icon: '✅',
    name: 'Tasklist',
    tagline: 'Human task assignment and completion UI',
    body: 'Tasklist is the default UI for human participants. When a User Task is reached, it appears in the assignee\'s queue. FluxNova routes tasks to candidate groups and tracks SLA timers — you can also build a custom UI on top of the Task REST API.',
    lss: 'LSS fit: Eliminates motion waste — the right task goes to the right person automatically. Poka-yoke forms prevent incomplete submissions. Wait time is measured precisely for every task.',
  },
  {
    icon: '📋',
    name: 'DMN Engine',
    tagline: 'Decision Model and Notation — rule tables',
    body: 'DMN separates business rules from process flow. A Decision Table maps input conditions to output values in a readable spreadsheet-like format. Subject matter experts can update rules without touching BPMN or code.',
    lss: 'LSS fit: Rules become explicit, auditable, and testable — replacing tribal knowledge and ad-hoc decision-making. Perfect for standardising judgment calls that previously introduced defect variation.',
  },
  {
    icon: '🖊️',
    name: 'Modeler',
    tagline: 'Visual BPMN and DMN editor',
    body: 'A drag-and-drop tool for creating BPMN process diagrams and DMN decision tables. Models can be deployed directly to the engine via the REST API. The same diagram you draw is the one that executes — no translation layer.',
    lss: 'LSS fit: BPMN diagrams serve as value stream maps that are directly executable. Process improvement workshops produce artefacts that can go straight to production.',
  },
  {
    icon: '🔌',
    name: 'REST API',
    tagline: 'Full HTTP API for every engine operation',
    body: 'Every FluxNova capability is accessible via REST: start instances, complete tasks, deploy definitions, query history, fetch variables. This makes FluxNova easy to integrate with any language, framework, or AI model.',
    lss: 'LSS fit: External systems and ML models can participate in processes without being tightly coupled. New AI capabilities can be added as External Task workers without modifying the process definition.',
  },
];

// ── Tab 2 data: 8 Wastes ──────────────────────────────────────────────────────

const WASTES = [
  {
    icon: '🚚',
    title: 'Transportation',
    sub: 'Moving information unnecessarily',
    back: 'FluxNova routes data directly to the next step via process variables — no email chains, shared drives, or copy-paste handoffs.',
  },
  {
    icon: '📦',
    title: 'Inventory',
    sub: 'Excessive work-in-progress',
    back: 'Process instance counts in Cockpit expose WIP immediately. SLA timers surface ageing items before they become backlogs.',
  },
  {
    icon: '🚶',
    title: 'Motion',
    sub: 'Navigating between systems',
    back: 'Tasklist consolidates all human work into one queue. External task workers eliminate the need for staff to log into upstream systems.',
  },
  {
    icon: '⏳',
    title: 'Waiting',
    sub: 'Delays between handoffs',
    back: 'Automated steps execute in milliseconds. Escalation timers trigger alerts when human steps exceed defined SLAs.',
  },
  {
    icon: '🏭',
    title: 'Overproduction',
    sub: 'Generating unnecessary artefacts',
    back: 'DMN tables produce exactly the decision output needed — no elaborate reports unless explicitly modelled. History API provides data on demand.',
  },
  {
    icon: '🔄',
    title: 'Over-processing',
    sub: 'Redundant review or approval steps',
    back: 'DMN automates decisions that don\'t need human review. Gateway conditions route only exception cases to managers.',
  },
  {
    icon: '🐛',
    title: 'Defects',
    sub: 'Errors from manual data entry',
    back: 'Form validation at the point of entry and process variables with typed schemas prevent bad data from propagating downstream.',
  },
  {
    icon: '🧠',
    title: 'Non-utilized Talent',
    sub: 'Skilled workers doing manual routing',
    back: 'Routing, escalation, and record-keeping are fully automated — freeing knowledge workers for judgment-intensive tasks only they can do.',
  },
];

// ── Tab 3 data: DMAIC phases ──────────────────────────────────────────────────

const DMAIC = [
  {
    letter: 'D',
    word: 'Define',
    title: 'Define the problem and process scope',
    body: 'Map the current-state process, identify pain points, and agree on KPIs. FluxNova\'s Modeler lets you create an executable "as-is" map — not just a diagram on a whiteboard.',
    example: 'Loan approval demo: The as-is map revealed 3 manual handoffs and no defined SLA. The BPMN diagram became the single source of truth for the team.',
  },
  {
    letter: 'M',
    word: 'Measure',
    title: 'Establish a data baseline',
    body: 'Collect quantitative data on the current process. FluxNova\'s history API provides precise durationInMillis per instance and per task — no manual time-tracking needed.',
    example: 'GET /history/process-instance?processDefinitionKey=loanApproval returns exact cycle times for every completed case — baseline in minutes, not weeks.',
  },
  {
    letter: 'A',
    word: 'Analyse',
    title: 'Identify root causes of variation',
    body: 'Cockpit dashboards surface incidents, bottlenecks, and outlier instances. Cross-referencing process data with outcome variables (approved/rejected, time-in-review) reveals where variation originates.',
    example: 'Ops dashboard showed 80% of cycle time occurred at the managerReview step. Root cause: tasks had no SLA timer, so queues grew unchecked.',
  },
  {
    letter: 'I',
    word: 'Improve',
    title: 'Design and validate improvements',
    body: 'Deploy a new version of the BPMN with countermeasures — SLA timers, automated pre-screening, parallel steps. Run a pilot and compare metrics against baseline using the same history API.',
    example: 'Adding a DMN-driven pre-qualification step rejected 40% of applications before manager review, cutting the manager\'s queue by half.',
  },
  {
    letter: 'C',
    word: 'Control',
    title: 'Sustain and monitor the improved process',
    body: 'FluxNova becomes the control plan. The deployed BPMN enforces the standard process — deviation is structurally impossible, not just policy-dependent. Cockpit monitors for new incidents.',
    example: 'The Ops dashboard (polling every 60s) acts as a SPC chart — any spike in pending count or avg decision time triggers investigation.',
  },
];

// ── Tab 4 data: Learning Roadmap ──────────────────────────────────────────────

const ROADMAP = [
  {
    label: 'Understand BPM fundamentals',
    desc: 'Learn what a process engine does, why BPMN 2.0 is the standard, and how FluxNova differs from workflow tools.',
  },
  {
    label: 'Model your first process in BPMN 2.0',
    desc: 'Draw a simple approval flow in Modeler: start event → user task → exclusive gateway → two end events.',
  },
  {
    label: 'Deploy a process to FluxNova',
    desc: 'Use the REST API (or the deployer container in this project) to push your BPMN and start a process instance.',
  },
  {
    label: 'Add a decision rule with DMN',
    desc: 'Create a decision table that maps credit score ranges to rate tiers. Connect it to your process as a Business Rule Task.',
  },
  {
    label: 'Build an External Task worker',
    desc: 'Write a Node.js worker that polls for service tasks, processes them (e.g., calls an API), and completes them with output variables.',
  },
  {
    label: 'Monitor with Cockpit',
    desc: 'Explore the Cockpit UI on port 8080. Inspect running instances, view variables, and resolve an artificial incident.',
  },
  {
    label: 'Connect process data to a dashboard',
    desc: 'Query the history API to build a stat dashboard — pending count, approval rate, average cycle time. The Ops page in this project is a template.',
  },
];

// ── Tab 5 data: Quiz ──────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    q: 'What does BPMN stand for?',
    options: [
      'Business Process Model and Notation',
      'Binary Process Management Node',
      'Base Protocol Model Network',
      'Business Program Management Notation',
    ],
    correct: 0,
    explanation: 'BPMN (Business Process Model and Notation) is an ISO/IEC 19510 standard for modeling business processes as visual diagrams that can be executed by a BPM engine.',
  },
  {
    q: 'In the loan approval demo, which component handles credit score calculation automatically?',
    options: [
      'A User Task assigned to a manager',
      'A DMN Decision Table',
      'An External Task Worker',
      'A Script Task inside the BPMN',
    ],
    correct: 2,
    explanation: 'External Task Workers poll FluxNova for service tasks, process them independently (simulating a credit bureau call), and return results as process variables — enabling scalable, decoupled service integration.',
  },
  {
    q: 'Which of the 8 Lean wastes is most directly addressed by FluxNova\'s automated task routing?',
    options: ['Defects', 'Overproduction', 'Waiting', 'Non-utilized talent'],
    correct: 2,
    explanation: 'Waiting is eliminated when processes automatically route to the next step the moment a preceding step completes — removing the delays that accumulate in manual handoff chains.',
  },
  {
    q: 'In DMAIC, which phase would you use FluxNova\'s history API to establish baseline cycle times?',
    options: ['Define', 'Measure', 'Analyse', 'Control'],
    correct: 1,
    explanation: 'The Measure phase establishes a quantitative baseline. FluxNova\'s /history/process-instance endpoint returns exact durationInMillis for every completed case — no manual time-tracking needed.',
  },
  {
    q: 'What does an Exclusive Gateway (XOR) do in BPMN?',
    options: [
      'Splits the flow into parallel branches that all execute simultaneously',
      'Routes flow to exactly one outgoing path based on a condition',
      'Merges multiple incoming flows into a single token',
      'Waits for an external event before continuing',
    ],
    correct: 1,
    explanation: 'An Exclusive Gateway evaluates conditions on each outgoing sequence flow and follows exactly one — typically the first condition that evaluates to true, with a default path as fallback.',
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function ComponentCard({ comp, expanded, onToggle }) {
  return (
    <div className={`hub-component-card${expanded ? ' open' : ''}`} onClick={onToggle}>
      <div className="hub-component-top">
        <span className="hub-component-icon">{comp.icon}</span>
        <div>
          <div className="hub-component-name">{comp.name}</div>
          <div className="hub-component-tagline">{comp.tagline}</div>
        </div>
        <span className="hub-component-chevron">▼</span>
      </div>
      {expanded && (
        <div className="hub-component-expand">
          <div className="hub-component-expand-inner">
            <p style={{ margin: '0 0 10px' }}>{comp.body}</p>
            <div className="hub-lss-note">⚡ {comp.lss}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function WasteCard({ waste, flipped, onFlip }) {
  return (
    <div className={`hub-waste-card${flipped ? ' flipped' : ''}`} onClick={onFlip}>
      <div className="hub-waste-inner">
        <div className="hub-waste-front">
          <div className="hub-waste-front-icon">{waste.icon}</div>
          <div className="hub-waste-front-title">{waste.title}</div>
          <div className="hub-waste-front-sub">{waste.sub}</div>
          <div className="hub-waste-front-hint">tap to flip →</div>
        </div>
        <div className="hub-waste-back">
          <div className="hub-waste-back-label">FluxNova eliminates this by…</div>
          <div className="hub-waste-back-body">{waste.back}</div>
        </div>
      </div>
    </div>
  );
}

function QuizQuestion({ question, qIndex, total, onAnswer, answered, selected }) {
  const [chosen, setChosen] = useState(null);
  const revealed = chosen !== null;

  const handleChoose = (i) => {
    if (revealed) return;
    setChosen(i);
    setTimeout(() => onAnswer(i === question.correct), 900);
  };

  return (
    <div className="hub-quiz">
      <div className="hub-quiz-progress">
        Question {qIndex + 1} of {total}
      </div>
      <p className="hub-quiz-q">{question.q}</p>
      <div className="hub-quiz-options">
        {question.options.map((opt, i) => {
          let cls = 'hub-quiz-option';
          if (chosen !== null) {
            if (i === question.correct) cls += ' correct';
            else if (i === chosen && i !== question.correct) cls += ' wrong';
          } else if (chosen === null) {
            cls += '';
          }
          return (
            <button key={i} className={cls} onClick={() => handleChoose(i)} disabled={revealed}>
              {opt}
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="hub-quiz-explanation">{question.explanation}</div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = ['What is FluxNova?', 'Lean Mapping', 'DMAIC Fit', 'Learning Roadmap', 'Quiz'];

export default function LearnPage() {
  const [activeTab, setActiveTab] = useState(0);

  // Tab 1 state
  const [expandedComp, setExpandedComp] = useState(null);

  // Tab 2 state
  const [flippedWastes, setFlippedWastes] = useState(new Set());

  // Tab 3 state
  const [dmaicPhase, setDmaicPhase] = useState(0);

  // Tab 4 state
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hub-roadmap') || '[]'); }
    catch { return []; }
  });

  const toggleCheck = (i) => {
    const next = checked.includes(i) ? checked.filter((x) => x !== i) : [...checked, i];
    setChecked(next);
    localStorage.setItem('hub-roadmap', JSON.stringify(next));
  };

  // Tab 5 state
  const [quizIndex, setQuizIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);

  const handleAnswer = (correct) => {
    const nextScore = correct ? score + 1 : score;
    if (quizIndex + 1 >= QUESTIONS.length) {
      setScore(nextScore);
      setQuizDone(true);
    } else {
      setScore(nextScore);
      setQuizIndex((i) => i + 1);
    }
  };

  const resetQuiz = () => {
    setQuizIndex(0);
    setScore(0);
    setQuizDone(false);
  };

  const progressPct = Math.round((checked.length / ROADMAP.length) * 100);

  return (
    <div className="hub-content">
      <div style={{ marginBottom: '8px' }}>
        <span className="hub-hero-eyebrow" style={{ textAlign: 'left', display: 'block' }}>
          Interactive Learning
        </span>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--hub-teal-deep)',
          margin: '6px 0 24px',
        }}>
          Learn FluxNova
        </h2>
      </div>

      {/* Tabs */}
      <div className="hub-learn-tabs">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={`hub-tab-btn${activeTab === i ? ' active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1 — What is FluxNova? */}
      {activeTab === 0 && (
        <div>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
            FluxNova is built on six core components. Click any card to see how it fits into a Lean Six Sigma improvement programme.
          </p>
          <div className="hub-component-grid">
            {COMPONENTS.map((comp) => (
              <ComponentCard
                key={comp.name}
                comp={comp}
                expanded={expandedComp === comp.name}
                onToggle={() => setExpandedComp(expandedComp === comp.name ? null : comp.name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tab 2 — Lean Mapping */}
      {activeTab === 1 && (
        <div>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
            The 8 Wastes of Lean (TIMWOODS) describe where value is lost in any process. Tap each card to see how FluxNova directly addresses that waste.
          </p>
          <div className="hub-waste-grid">
            {WASTES.map((waste, i) => (
              <WasteCard
                key={waste.title}
                waste={waste}
                flipped={flippedWastes.has(i)}
                onFlip={() => {
                  const next = new Set(flippedWastes);
                  next.has(i) ? next.delete(i) : next.add(i);
                  setFlippedWastes(next);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tab 3 — DMAIC Fit */}
      {activeTab === 2 && (
        <div>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
            FluxNova supports every phase of a DMAIC improvement project. Click each phase to see how the engine helps.
          </p>
          <div className="hub-dmaic-stepper">
            {DMAIC.map((phase, i) => (
              <button
                key={phase.letter}
                className={`hub-dmaic-btn${dmaicPhase === i ? ' active' : ''}`}
                onClick={() => setDmaicPhase(i)}
              >
                <span className="hub-dmaic-letter">{phase.letter}</span>
                <span className="hub-dmaic-word">{phase.word}</span>
              </button>
            ))}
          </div>
          <div className="hub-dmaic-panel">
            <h3 className="hub-dmaic-phase-title">{DMAIC[dmaicPhase].title}</h3>
            <p className="hub-dmaic-body">{DMAIC[dmaicPhase].body}</p>
            <div className="hub-dmaic-example">
              <span className="hub-dmaic-example-label">Loan demo example</span>
              {DMAIC[dmaicPhase].example}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4 — Learning Roadmap */}
      {activeTab === 3 && (
        <div className="hub-roadmap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', color: 'var(--hub-teal)' }}>
              {checked.length}/{ROADMAP.length} complete
            </span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', color: 'var(--hub-teal)' }}>
              {progressPct}%
            </span>
          </div>
          <div className="hub-progress-bar-wrap">
            <div className="hub-progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="hub-roadmap-steps">
            {ROADMAP.map((step, i) => {
              const done = checked.includes(i);
              return (
                <div
                  key={i}
                  className={`hub-roadmap-step${done ? ' done' : ''}`}
                  onClick={() => toggleCheck(i)}
                >
                  <span className="hub-roadmap-num">{String(i + 1).padStart(2, '0')}</span>
                  <div className="hub-roadmap-check">{done ? '✓' : ''}</div>
                  <div>
                    <div className="hub-roadmap-label">{step.label}</div>
                    <div className="hub-roadmap-desc">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="hub-roadmap-reset" onClick={() => {
            setChecked([]);
            localStorage.removeItem('hub-roadmap');
          }}>
            Reset progress
          </button>
        </div>
      )}

      {/* Tab 5 — Quiz */}
      {activeTab === 4 && (
        <div>
          {quizDone ? (
            <div className="hub-quiz-result">
              <div className="hub-quiz-score-circle">{score}/{QUESTIONS.length}</div>
              <h3 className="hub-quiz-result-title">
                {score === QUESTIONS.length ? 'Perfect score! 🎉'
                  : score >= 3 ? 'Well done!'
                  : 'Keep learning!'}
              </h3>
              <p className="hub-quiz-result-sub">
                You answered {score} out of {QUESTIONS.length} questions correctly.
                {score < QUESTIONS.length && ' Review the Learn tabs and try again.'}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="hub-btn" onClick={resetQuiz}>Try again</button>
                <button className="hub-btn ghost" onClick={() => setActiveTab(0)}>
                  Review content
                </button>
              </div>
            </div>
          ) : (
            <QuizQuestion
              key={quizIndex}
              question={QUESTIONS[quizIndex]}
              qIndex={quizIndex}
              total={QUESTIONS.length}
              onAnswer={handleAnswer}
            />
          )}
        </div>
      )}
    </div>
  );
}
