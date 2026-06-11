import { useEffect, useRef, useState } from 'react';
import ProcessTimeline from '../components/ProcessTimeline';
import { getManagerTasks, completeReviewTask } from '../services/api';
import styles from './ManagerPage.module.css';

// ── Formatters ────────────────────────────────────────────────────────────────

function formatCurrency(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatPurpose(s) {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

const EMPLOYMENT_MAP = {
  full_time: 'Full-time employed',
  employed_full: 'Full-time employed',
  part_time: 'Part-time employed',
  employed_part: 'Part-time employed',
  self_employed: 'Self-employed',
  contract: 'Contract / freelance',
  retired: 'Retired',
  unemployed: 'Unemployed',
  student: 'Student',
};

function formatEmployment(s) {
  return EMPLOYMENT_MAP[s] || (s ? s.replace(/_/g, ' ') : '—');
}

// Pull rateTier / interestRate out of rateResult array if the top-level vars are null
function resolveRateFields(v) {
  let rr = v.rateResult;
  if (typeof rr === 'string') {
    try { rr = JSON.parse(rr); } catch { rr = null; }
  }
  const first = Array.isArray(rr) ? rr[0] : (rr && typeof rr === 'object' ? rr : null);
  return {
    rateTier: v.rateTier || first?.rateTier || null,
    interestRate: v.interestRate ?? first?.interestRate ?? null,
  };
}

function creditScoreCls(score) {
  if (score == null) return '';
  if (score >= 700) return styles.pillGreen;
  if (score >= 600) return styles.pillAmber;
  return styles.pillRed;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DetailRow({ label, value }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailKey}>{label}</span>
      <span className={styles.detailVal}>{value}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManagerPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // null | 'fetch' | 'complete'
  const [expandedId, setExpandedId] = useState(null);
  const [notes, setNotes] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [decisions, setDecisions] = useState({});
  const [fading, setFading] = useState(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function load() {
      try {
        const res = await getManagerTasks();
        if (!mountedRef.current) return;
        setTasks(res.data);
        setError(null);
      } catch {
        if (!mountedRef.current) return;
        setError('fetch');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, 30000);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, []);

  const handleComplete = async (taskId, approved) => {
    const task = tasks.find((t) => t.id === taskId);
    const v = task?.variables ?? {};
    setSubmitting((s) => ({ ...s, [taskId]: true }));
    try {
      await completeReviewTask(taskId, { approved, reviewNote: notes[taskId] || '' });
      setDecisions((d) => ({
        ...d,
        [taskId]: { approved, firstName: v.applicantFirstName, lastName: v.applicantLastName },
      }));
      setExpandedId((id) => (id === taskId ? null : id));
      // Show result banner for 2.5 s then fade and remove
      setTimeout(() => {
        setFading((f) => new Set([...f, taskId]));
        setTimeout(() => {
          setTasks((t) => t.filter((tk) => tk.id !== taskId));
          setDecisions((d) => { const n = { ...d }; delete n[taskId]; return n; });
          setFading((f) => { const n = new Set(f); n.delete(taskId); return n; });
        }, 380);
      }, 2500);
    } catch {
      setError('complete');
      setSubmitting((s) => ({ ...s, [taskId]: false }));
    }
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    getManagerTasks()
      .then((res) => { setTasks(res.data); setLoading(false); })
      .catch(() => { setError('fetch'); setLoading(false); });
  };

  return (
    <div className={styles.layout}>
      <ProcessTimeline
        activeStep="review"
        completedSteps={['apply', 'credit_check', 'rate_decision']}
      />

      <main className={styles.main}>
        <header className={styles.docHeader}>
          <div className={styles.headerLeft}>
            <span className={styles.eyebrow}>LOAN DESK</span>
            <h1 className={styles.heading}>Manager review queue</h1>
            <p className={styles.subheading}>Applications pending your decision</p>
          </div>
          <span className={styles.refreshBadge}>Auto-refresh 30s</span>
        </header>

        {error === 'fetch' && (
          <div className={styles.errorBanner}>
            Failed to load tasks.
            <button className={styles.retryBtn} onClick={retry}>Retry</button>
          </div>
        )}
        {error === 'complete' && (
          <div className={styles.errorBanner}>
            Failed to submit decision. Please try again.
          </div>
        )}

        {loading ? (
          <div className={styles.skeletonList}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skRow}>
                  <div className={`${styles.skLine} ${styles.skName}`} />
                  <div className={`${styles.skLine} ${styles.skDate}`} />
                </div>
                <div className={`${styles.skLine} ${styles.skAmount}`} />
                <div className={styles.skRow}>
                  <div className={`${styles.skLine} ${styles.skPill}`} />
                  <div className={`${styles.skLine} ${styles.skPill}`} />
                  <div className={`${styles.skLine} ${styles.skPill}`} />
                </div>
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyCircle}>✓</div>
            <h2 className={styles.emptyHeading}>All clear</h2>
            <p className={styles.emptyDesc}>No applications awaiting review.</p>
            <span className={styles.emptyNote}>Checks every 30 seconds</span>
          </div>
        ) : (
          <div className={styles.taskList}>
            {tasks.map((task) => {
              const v = task.variables ?? {};
              const { rateTier, interestRate } = resolveRateFields(v);
              const expanded = expandedId === task.id;
              const isFading = fading.has(task.id);
              const busy = submitting[task.id];
              const decision = decisions[task.id];

              return (
                <div
                  key={task.id}
                  className={`${styles.taskCard} ${isFading ? styles.fadeOut : ''}`}
                >
                  {decision ? (
                    <div className={`${styles.resultBanner} ${decision.approved ? styles.resultApproved : styles.resultRejected}`}>
                      <span className={styles.resultMark}>{decision.approved ? '✓' : '✗'}</span>
                      {decision.approved ? 'Approved' : 'Rejected'} — {decision.firstName} {decision.lastName}
                    </div>
                  ) : (
                    <>
                      {/* Row 1: name + date */}
                      <div className={styles.cardRow1}>
                        <span className={styles.applicantName}>
                          {v.applicantFirstName} {v.applicantLastName}
                        </span>
                        <span className={styles.cardDate}>{formatDate(task.created)}</span>
                      </div>

                      {/* Row 2: amount + term + purpose */}
                      <div className={styles.cardRow2}>
                        <span className={styles.loanAmount}>{formatCurrency(v.loanAmount)}</span>
                        {v.termMonths && (
                          <span className={styles.loanMeta}>{v.termMonths} months</span>
                        )}
                        {v.loanPurpose && (
                          <span className={styles.loanMeta}>{formatPurpose(v.loanPurpose)}</span>
                        )}
                      </div>

                      {/* Row 3: data pills */}
                      <div className={styles.cardRow3}>
                        {v.creditScore != null && (
                          <span className={`${styles.pill} ${creditScoreCls(v.creditScore)}`}>
                            Score {v.creditScore}
                          </span>
                        )}
                        {rateTier && (
                          <span className={`${styles.pill} ${styles.pillNavy}`}>{rateTier}</span>
                        )}
                        {interestRate != null && (
                          <span className={`${styles.pill} ${styles.pillCream}`}>
                            {interestRate}% p.a.
                          </span>
                        )}
                      </div>

                      {/* Row 4: action */}
                      <div className={styles.cardRow4}>
                        <button
                          className={styles.btnGhost}
                          onClick={() => setExpandedId(expanded ? null : task.id)}
                        >
                          {expanded ? 'Close' : 'Review application'}
                        </button>
                      </div>

                      {/* Inline review panel */}
                      {expanded && (
                        <div className={styles.panel}>
                          <div className={styles.panelCols}>
                            <div className={styles.panelLeft}>
                              <div className={styles.sectionHeader}>
                                <span className={styles.sectionIdx}>01</span>
                                <span className={styles.sectionTitle}>Applicant</span>
                              </div>
                              <div className={styles.detailList}>
                                <DetailRow label="Full name" value={`${v.applicantFirstName ?? ''} ${v.applicantLastName ?? ''}`.trim() || '—'} />
                                {v.applicantEmail && <DetailRow label="Email" value={v.applicantEmail} />}
                                <DetailRow label="Employment" value={formatEmployment(v.employmentStatus)} />
                                <DetailRow label="Annual income" value={formatCurrency(v.annualIncome)} />
                              </div>

                              <div className={`${styles.sectionHeader} ${styles.sectionHeaderSpaced}`}>
                                <span className={styles.sectionIdx}>02</span>
                                <span className={styles.sectionTitle}>Loan request</span>
                              </div>
                              <div className={styles.detailList}>
                                <DetailRow label="Amount" value={formatCurrency(v.loanAmount)} />
                                <DetailRow label="Term" value={v.termMonths ? `${v.termMonths} months` : '—'} />
                                <DetailRow label="Purpose" value={formatPurpose(v.loanPurpose)} />
                                <DetailRow label="Credit score" value={v.creditScore ?? '—'} />
                                {rateTier && <DetailRow label="Rate tier" value={rateTier} />}
                                {interestRate != null && <DetailRow label="Interest rate" value={`${interestRate}%`} />}
                              </div>
                            </div>

                            <div className={styles.panelRight}>
                              <span className={styles.decisionLabel}>Your decision</span>
                              <textarea
                                className={styles.noteInput}
                                rows={3}
                                placeholder="Add a note for the record..."
                                value={notes[task.id] || ''}
                                onChange={(e) => setNotes((n) => ({ ...n, [task.id]: e.target.value }))}
                              />
                              <div className={styles.decisionActions}>
                                <button
                                  className={styles.btnReject}
                                  onClick={() => handleComplete(task.id, false)}
                                  disabled={busy}
                                >
                                  {busy ? 'Processing…' : 'Reject'}
                                </button>
                                <button
                                  className={styles.btnApprove}
                                  onClick={() => handleComplete(task.id, true)}
                                  disabled={busy}
                                >
                                  {busy ? 'Processing…' : 'Approve'}
                                </button>
                              </div>
                              <p className={styles.legalNote}>
                                This decision is final and recorded in the process audit log.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
