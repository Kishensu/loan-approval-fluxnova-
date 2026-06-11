import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ProcessTimeline from '../components/ProcessTimeline';
import { getApplicationStatus } from '../services/api';
import styles from './StatusPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_ORDER = ['apply', 'credit_check', 'rate_decision', 'review', 'decision'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveActiveStep(currentTask, variables) {
  if (variables?.approved === true || variables?.approved === false) return 'decision';
  return currentTask || 'apply';
}

function deriveCompletedSteps(activeStep) {
  const idx = STEP_ORDER.indexOf(activeStep);
  return idx > 0 ? STEP_ORDER.slice(0, idx) : [];
}

function deriveStatusLabel(currentTask, variables) {
  if (variables?.approved === true) return 'APPROVED';
  if (variables?.approved === false) return 'REJECTED';
  if (currentTask === 'review') return 'IN_REVIEW';
  return 'PENDING';
}

function statusBadgeCls(label, s) {
  if (label === 'APPROVED') return s.badgeApproved;
  if (label === 'REJECTED') return s.badgeRejected;
  if (label === 'IN_REVIEW') return s.badgeInReview;
  return s.badgePending;
}

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

function formatCurrency(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
  }).format(n);
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

function formatPurpose(s) {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryRow({ label, value }) {
  return (
    <div className={styles.summaryRow}>
      <span className={styles.summaryKey}>{label}</span>
      <span className={styles.summaryVal}>{value}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StatusPage() {
  const { instanceId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // null | 'notFound' | 'network'
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let intervalId;
    let stopped = false;

    const fetchStatus = async () => {
      try {
        const res = await getApplicationStatus(instanceId);
        if (stopped) return;
        const d = res.data;
        setData(d);
        setError(null);
        setLoading(false);
        const vars = d?.variables ?? {};
        const isTerminal =
          d?.status === 'completed' ||
          vars.approved === true ||
          vars.approved === false;
        if (isTerminal) clearInterval(intervalId);
      } catch (err) {
        if (stopped) return;
        setLoading(false);
        if (err.response?.status === 404) {
          setError('notFound');
          clearInterval(intervalId);
        } else {
          setError('network');
        }
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 4000);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [instanceId, retryCount]);

  // ── Derived state ───────────────────────────────────────────────────────────

  const vars = data?.variables ?? {};
  const { rateTier, interestRate } = resolveRateFields(vars);
  const activeStep = deriveActiveStep(data?.currentTask, vars);
  const completedSteps = deriveCompletedSteps(activeStep);
  const statusLabel = deriveStatusLabel(data?.currentTask, vars);
  const isTerminal = vars.approved === true || vars.approved === false;
  const shortRef = instanceId?.substring(0, 8);

  // ── 404 state ───────────────────────────────────────────────────────────────

  if (error === 'notFound') {
    return (
      <div className={styles.layout}>
        <ProcessTimeline activeStep="apply" completedSteps={[]} />
        <main className={styles.main}>
          <div className={styles.notFound}>
            <span className={styles.notFoundCode}>404</span>
            <h2 className={styles.notFoundTitle}>Application not found</h2>
            <p className={styles.notFoundDesc}>
              No application exists for that reference number.
            </p>
            <Link to="/apply" className={styles.notFoundLink}>← File a new application</Link>
          </div>
          <div className={styles.backLink}>
            <Link to="/apply" className={styles.link}>← File another application</Link>
          </div>
        </main>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className={styles.layout}>
      <ProcessTimeline activeStep={activeStep} completedSteps={completedSteps} />

      <main className={styles.main}>
        <header className={styles.docHeader}>
          <span className={styles.eyebrow}>APPLICATION STATUS</span>
          <h1 className={styles.heading}>
            {loading && !data
              ? 'Loading…'
              : vars.applicantFirstName
              ? `${vars.applicantFirstName} ${vars.applicantLastName}`
              : 'Loan Application'}
          </h1>
          <p className={styles.refLine}>
            Ref: <span className={styles.refId}>{shortRef}…</span>
          </p>
        </header>

        {error === 'network' && (
          <div className={styles.errorBanner}>
            Could not reach server.
            <button
              className={styles.retryBtn}
              onClick={() => { setError(null); setLoading(true); setRetryCount((c) => c + 1); }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className={styles.skeletonWrap}>
            <div className={`${styles.skLine} ${styles.skBadge}`} />
            <div className={styles.skCard}>
              <div className={styles.skLine} />
              <div className={`${styles.skLine} ${styles.skShort}`} />
              <div className={styles.skLine} />
              <div className={`${styles.skLine} ${styles.skShort}`} />
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Status badge */}
            <div className={styles.badgeRow}>
              <span className={`${styles.badge} ${statusBadgeCls(statusLabel, styles)}`}>
                {statusLabel === 'IN_REVIEW' ? 'IN REVIEW' : statusLabel}
              </span>
            </div>

            {/* Application summary */}
            <section className={styles.summaryCard}>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCol}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionIdx}>01</span>
                    <span className={styles.sectionTitle}>Applicant</span>
                  </div>
                  <div className={styles.summaryRows}>
                    <SummaryRow
                      label="Full name"
                      value={`${vars.applicantFirstName ?? ''} ${vars.applicantLastName ?? ''}`.trim() || '—'}
                    />
                    {vars.applicantEmail && <SummaryRow label="Email" value={vars.applicantEmail} />}
                    {vars.employmentStatus && (
                      <SummaryRow label="Employment" value={formatEmployment(vars.employmentStatus)} />
                    )}
                    {vars.annualIncome != null && (
                      <SummaryRow label="Annual income" value={formatCurrency(vars.annualIncome)} />
                    )}
                  </div>
                </div>

                <div className={styles.summaryCol}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionIdx}>02</span>
                    <span className={styles.sectionTitle}>Loan details</span>
                  </div>
                  <div className={styles.summaryRows}>
                    <SummaryRow label="Amount" value={formatCurrency(vars.loanAmount)} />
                    {vars.termMonths && (
                      <SummaryRow label="Term" value={`${vars.termMonths} months`} />
                    )}
                    {vars.loanPurpose && (
                      <SummaryRow label="Purpose" value={formatPurpose(vars.loanPurpose)} />
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Rate result card — shown once DMN has run */}
            {rateTier && (
              <section className={styles.rateCard}>
                <span className={styles.rateEyebrow}>RATE ASSIGNED</span>
                <div className={styles.rateStats}>
                  {vars.creditScore != null && (
                    <div className={styles.rateStat}>
                      <span className={styles.rateStatLabel}>Credit score</span>
                      <span className={styles.rateStatVal}>{vars.creditScore}</span>
                    </div>
                  )}
                  <div className={styles.rateStat}>
                    <span className={styles.rateStatLabel}>Rate tier</span>
                    <span className={styles.rateStatVal}>{rateTier}</span>
                  </div>
                  <div className={styles.rateStat}>
                    <span className={styles.rateStatLabel}>Interest rate</span>
                    <span className={styles.rateStatVal}>
                      {interestRate != null ? `${interestRate}%` : '—'}
                    </span>
                  </div>
                </div>
                <p className={styles.rateNote}>Rate determined by automated credit assessment</p>
              </section>
            )}

            {/* Decision card */}
            {isTerminal && (
              <section
                className={`${styles.decisionCard} ${vars.approved ? styles.decisionApproved : styles.decisionRejected}`}
              >
                <div className={`${styles.decisionCircle} ${vars.approved ? styles.circleApproved : styles.circleRejected}`}>
                  {vars.approved ? '✓' : '✗'}
                </div>
                <div className={styles.decisionBody}>
                  <h2 className={styles.decisionTitle}>
                    {vars.approved ? 'Loan approved' : 'Application not approved'}
                  </h2>
                  <p className={styles.decisionDesc}>
                    {vars.approved
                      ? 'Your application has been approved. Our team will be in touch.'
                      : 'Unfortunately your application did not meet our criteria at this time.'}
                  </p>
                  {vars.approved && (
                    <div className={styles.decisionDetails}>
                      <div className={styles.decisionDetail}>
                        <span className={styles.decisionDetailKey}>Loan amount</span>
                        <span className={styles.decisionDetailVal}>{formatCurrency(vars.loanAmount)}</span>
                      </div>
                      {vars.termMonths && (
                        <div className={styles.decisionDetail}>
                          <span className={styles.decisionDetailKey}>Term</span>
                          <span className={styles.decisionDetailVal}>{vars.termMonths} months</span>
                        </div>
                      )}
                      {rateTier && (
                        <div className={styles.decisionDetail}>
                          <span className={styles.decisionDetailKey}>Rate tier</span>
                          <span className={styles.decisionDetailVal}>{rateTier}</span>
                        </div>
                      )}
                      {interestRate != null && (
                        <div className={styles.decisionDetail}>
                          <span className={styles.decisionDetailKey}>Interest rate</span>
                          <span className={styles.decisionDetailVal}>{interestRate}% p.a.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Polling spinner */}
            {!isTerminal && (
              <div className={styles.pollingNote}>
                <span className={styles.spinner} />
                Checking for updates…
              </div>
            )}
          </>
        )}

        <div className={styles.backLink}>
          <Link to="/apply" className={styles.link}>← File another application</Link>
        </div>
      </main>
    </div>
  );
}
