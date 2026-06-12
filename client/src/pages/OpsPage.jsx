import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { getOpsStats, getProcessHistory, getManagerTasks } from '../services/api';
import styles from './OpsPage.module.css';

// ── Formatters ────────────────────────────────────────────────────────────────

function formatCurrency(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatDuration(ms) {
  if (ms == null) return '—';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) {
    const m = Math.floor(ms / 60000);
    const s = Math.round((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function formatTimeAgo(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return formatDate(iso);
}

function formatPurpose(s) {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function creditScoreCls(score, s) {
  if (score == null) return '';
  if (score >= 700) return s.scoreGreen;
  if (score >= 600) return s.scoreAmber;
  return s.scoreRed;
}

function formatAvgTime(ms) {
  if (!ms) return null;
  return `${formatDuration(ms)} avg`;
}

// ── Queue row ─────────────────────────────────────────────────────────────────

function QueueRow({ task, index, navigate }) {
  const v = task.variables ?? {};
  const score = v.creditScore;
  const scoreCls = score != null
    ? (score >= 700 ? styles.pillGreen : score >= 600 ? styles.pillAmber : styles.pillRed)
    : '';

  return (
    <div
      className={styles.queueRow}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className={styles.queueCol1}>
        <span className={styles.queueName}>
          {v.applicantFirstName} {v.applicantLastName}
        </span>
        <span className={styles.queueTime}>{formatTimeAgo(task.created)}</span>
      </div>
      <div className={styles.queueCol2}>
        <span className={styles.queueAmount}>{formatCurrency(v.loanAmount)}</span>
        {v.termMonths && <span className={styles.queueMeta}>{v.termMonths} mo</span>}
      </div>
      <div className={`${styles.queueCol3} ${styles.hideOnMobile}`}>
        {score != null && (
          <span className={`${styles.pill} ${scoreCls}`}>
            {score}
          </span>
        )}
      </div>
      <div className={`${styles.queueCol4} ${styles.hideOnMobile}`}>
        {v.rateTier && (
          <span className={`${styles.pill} ${styles.pillNavy}`}>{v.rateTier}</span>
        )}
      </div>
      <div className={styles.queueCol5}>
        <button className={styles.btnReview} onClick={() => navigate('/manager')}>
          Review →
        </button>
      </div>
    </div>
  );
}

// ── History table row ─────────────────────────────────────────────────────────

function HistoryRow({ item, index }) {
  const scoreCls = item.creditScore != null
    ? (item.creditScore >= 700 ? styles.scoreGreen
      : item.creditScore >= 600 ? styles.scoreAmber
      : styles.scoreRed)
    : '';

  return (
    <tr className={index % 2 === 0 ? styles.rowEven : styles.rowOdd}>
      <td className={styles.tdName}>{item.applicantName}</td>
      <td className={styles.tdMono}>{formatCurrency(item.loanAmount)}</td>
      <td className={styles.tdMuted}>{item.termMonths ? `${item.termMonths} months` : '—'}</td>
      <td>{formatPurpose(item.loanPurpose)}</td>
      <td className={`${styles.tdMono} ${scoreCls}`}>{item.creditScore ?? '—'}</td>
      <td>{item.rateTier ?? '—'}</td>
      <td>
        {item.approved === true && (
          <span className={`${styles.decisionChip} ${styles.chipApproved}`}>Approved</span>
        )}
        {item.approved === false && (
          <span className={`${styles.decisionChip} ${styles.chipRejected}`}>Rejected</span>
        )}
        {item.approved == null && <span className={styles.tdMuted}>—</span>}
      </td>
      <td className={styles.tdMono}>{formatDuration(item.durationInMillis)}</td>
      <td className={styles.tdMuted}>{formatDate(item.startTime)}</td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function OpsPage() {
  const navigate = useNavigate();

  // Stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  // Queue
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueUpdated, setQueueUpdated] = useState(null);

  // History
  const [history, setHistory] = useState({ total: 0, items: [] });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [histPage, setHistPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  // Section refs for scroll-to
  const queueRef = useRef(null);
  const historyRef = useRef(null);

  // ── Stats ───────────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await getOpsStats();
      setStats(res.data);
      setStatsError(false);
    } catch {
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 60000);
    return () => clearInterval(t);
  }, [fetchStats]);

  // ── Queue ───────────────────────────────────────────────────────────────────

  const fetchQueue = useCallback(async () => {
    try {
      const res = await getManagerTasks();
      setQueue(res.data);
      setQueueUpdated(new Date());
    } catch {
      // silently keep last queue state
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const t = setInterval(fetchQueue, 30000);
    return () => clearInterval(t);
  }, [fetchQueue]);

  // ── History ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    setHistoryLoading(true);
    setHistoryError(false);
    getProcessHistory({ page: histPage, pageSize: PAGE_SIZE, status: statusFilter })
      .then((res) => { setHistory(res.data); })
      .catch(() => setHistoryError(true))
      .finally(() => setHistoryLoading(false));
  }, [histPage, statusFilter]);

  const handleStatusFilter = (s) => {
    setStatusFilter(s);
    setHistPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(history.total / PAGE_SIZE));
  const firstItem = (histPage - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(histPage * PAGE_SIZE, history.total);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Top nav */}
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <span className={styles.navEyebrow}>LOAN OPS</span>
          <span className={styles.navTitle}>Manager Dashboard</span>
        </div>
        <div className={styles.navLinks}>
          <button
            className={styles.navLink}
            onClick={() => queueRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            Queue
          </button>
          <button
            className={styles.navLink}
            onClick={() => historyRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            History
          </button>
          <Link to="/apply" className={`${styles.navLink} ${styles.navBack}`}>
            ← Portal
          </Link>
        </div>
      </nav>

      <div className={styles.content}>
        {/* ── Section 1: Stats ─────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionLabel}>
              <span className={styles.sectionIdx}>01</span>
              <span className={styles.sectionTitle}>Overview</span>
            </div>
          </div>

          {statsLoading ? (
            <div className={styles.statsGrid}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={styles.statSkeleton}>
                  <div className={styles.skAccent} />
                  <div className={styles.skBody}>
                    <div className={`${styles.skLine} ${styles.skVal}`} />
                    <div className={`${styles.skLine} ${styles.skLbl}`} />
                  </div>
                </div>
              ))}
            </div>
          ) : statsError ? (
            <div className={styles.inlineError}>
              Failed to load stats.
              <button className={styles.btnRetry} onClick={() => { setStatsError(false); setStatsLoading(true); fetchStats(); }}>
                Retry
              </button>
            </div>
          ) : (
            <div className={styles.statsGrid}>
              <StatCard
                value={stats?.pending ?? 0}
                label="Awaiting review"
                accent="var(--brass)"
                icon="⏳"
              />
              <StatCard
                value={stats?.approved ?? 0}
                label="Loans approved"
                accent="var(--green)"
                icon="✓"
              />
              <StatCard
                value={stats?.rejected ?? 0}
                label="Not approved"
                accent="var(--red)"
                icon="✗"
              />
              <StatCard
                value={stats?.approvalRate ?? 0}
                label="Approval rate"
                accent="var(--brass)"
                icon="◎"
                isPercent
                subValue={stats?.avgDecisionTimeMs ? formatAvgTime(stats.avgDecisionTimeMs) : null}
              />
            </div>
          )}
        </section>

        {/* ── Section 2: Queue ─────────────────────────────────────────────── */}
        <section className={styles.section} ref={queueRef}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionLabel}>
              <span className={styles.sectionIdx}>02</span>
              <span className={styles.sectionTitle}>Live queue</span>
            </div>
            <div className={styles.sectionActions}>
              {!queueLoading && (
                <span className={styles.countBadge}>
                  {queue.length} pending
                </span>
              )}
              <button className={styles.btnGhost} onClick={fetchQueue}>Refresh</button>
            </div>
          </div>
          {queueUpdated && (
            <div className={styles.updatedLine}>
              Updated {formatTimeAgo(queueUpdated.toISOString())}
            </div>
          )}

          {queueLoading ? (
            <div className={styles.queueSkeletons}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.queueSkRow}>
                  <div className={`${styles.skLine} ${styles.skQName}`} />
                  <div className={`${styles.skLine} ${styles.skQAmt}`} />
                  <div className={`${styles.skLine} ${styles.skQBtn}`} />
                </div>
              ))}
            </div>
          ) : queue.length === 0 ? (
            <div className={styles.queueEmpty}>
              Queue is clear — no applications pending review
            </div>
          ) : (
            <div className={styles.queueList}>
              <div className={styles.queueHeader}>
                <span>Applicant</span>
                <span>Amount</span>
                <span className={styles.hideOnMobile}>Score</span>
                <span className={styles.hideOnMobile}>Tier</span>
                <span></span>
              </div>
              {queue.map((task, i) => (
                <QueueRow key={task.id} task={task} index={i} navigate={navigate} />
              ))}
            </div>
          )}
        </section>

        {/* ── Section 3: History ───────────────────────────────────────────── */}
        <section className={styles.section} ref={historyRef}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionLabel}>
              <span className={styles.sectionIdx}>03</span>
              <span className={styles.sectionTitle}>Decision history</span>
            </div>
            <div className={styles.filterPills}>
              {['all', 'approved', 'rejected'].map((s) => (
                <button
                  key={s}
                  className={`${styles.filterPill} ${statusFilter === s ? styles.filterActive : ''}`}
                  onClick={() => handleStatusFilter(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {historyError ? (
            <div className={styles.inlineError}>
              Failed to load history.
              <button className={styles.btnRetry} onClick={() => { setHistoryError(false); setHistoryLoading(true); setHistPage(1); }}>
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Amount</th>
                      <th>Term</th>
                      <th>Purpose</th>
                      <th>Score</th>
                      <th>Rate tier</th>
                      <th>Decision</th>
                      <th>Duration</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLoading ? (
                      Array.from({ length: PAGE_SIZE }).map((_, i) => (
                        <tr key={i} className={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                          {Array.from({ length: 9 }).map((__, j) => (
                            <td key={j}>
                              <div className={`${styles.skLine} ${styles.skCell}`} />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : history.items.length === 0 ? (
                      <tr>
                        <td colSpan={9} className={styles.tableEmpty}>
                          No decisions recorded yet
                        </td>
                      </tr>
                    ) : (
                      history.items.map((item, i) => (
                        <HistoryRow key={item.instanceId} item={item} index={i} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {history.total > 0 && (
                <div className={styles.pagination}>
                  <span className={styles.paginationInfo}>
                    Showing {firstItem}–{lastItem} of {history.total} applications
                  </span>
                  <div className={styles.paginationBtns}>
                    <button
                      className={styles.btnGhost}
                      onClick={() => setHistPage((p) => Math.max(1, p - 1))}
                      disabled={histPage <= 1}
                    >
                      Previous
                    </button>
                    <button
                      className={styles.btnGhost}
                      onClick={() => setHistPage((p) => Math.min(totalPages, p + 1))}
                      disabled={histPage >= totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
