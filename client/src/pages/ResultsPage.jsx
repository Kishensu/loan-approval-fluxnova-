import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFormResults } from '../services/api';
import styles from './ResultsPage.module.css';

function calcSummary(calc) {
  if (!calc) return '—';
  if (calc.type === 'loan')   return `$${calc.monthlyPayment?.toFixed(2)}/mo`;
  if (calc.type === 'refund') return `Net $${calc.netRefund?.toFixed(2)}`;
  return `Fee $${calc.flatProcessingFee?.toFixed(2)}`;
}

function priorityClass(p) {
  if (p === 'high')   return styles.pHigh;
  if (p === 'low')    return styles.pLow;
  return styles.pNormal;
}

function DetailDrawer({ record, onClose }) {
  const v = record.fields || {};
  const calc = record.calculationResult;

  return (
    <div className={styles.drawer}>
      <div className={styles.drawerHeader}>
        <h3 className={styles.drawerTitle}>Result detail</h3>
        <button className={styles.drawerClose} onClick={onClose}>×</button>
      </div>

      <div className={styles.drawerSection}>
        <div className={styles.drawerLabel}>Process Instance</div>
        <div className={styles.drawerMono}>{record.processInstanceId}</div>
      </div>

      <div className={styles.drawerSection}>
        <div className={styles.drawerLabel}>File</div>
        <div className={styles.drawerValue}>{record.originalFilename || '—'}</div>
        {record.documentId && (
          <a
            href={`/api/forms/document/${record.documentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.viewImageLink}
          >
            View original form ↗
          </a>
        )}
      </div>

      <div className={styles.drawerSection}>
        <div className={styles.drawerLabel}>Extracted Fields</div>
        {Object.entries(v).map(([name, fv]) => (
          <div key={name} className={styles.drawerField}>
            <span className={styles.drawerFieldName}>{name}</span>
            <span className={styles.drawerFieldValue}>{String(fv?.value ?? '—')}</span>
            <span className={styles.drawerConfidence} style={{ color: fv?.confidence >= 0.85 ? '#166534' : '#b91c1c' }}>
              {fv?.confidence != null ? `${Math.round(fv.confidence * 100)}%` : ''}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.drawerSection}>
        <div className={styles.drawerLabel}>Triage</div>
        <div className={styles.drawerKV}>
          <span>Category</span><span>{record.category || '—'}</span>
          <span>Priority</span><span className={`${styles.pill} ${priorityClass(record.priority)}`}>{record.priority || '—'}</span>
          <span>Path</span><span>{record.wasReviewed ? '🔄 Human reviewed' : '⚡ Straight-through'}</span>
        </div>
      </div>

      {calc && (
        <div className={styles.drawerSection}>
          <div className={styles.drawerLabel}>Calculation</div>
          <pre className={styles.calcJson}>{JSON.stringify(calc, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await getFormResults();
        if (mounted) setResults(res.data);
      } catch (err) {
        if (mounted) setError(err.response?.data?.error || 'Could not load results');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const selectedRecord = results?.find((r) => r.processInstanceId === selected);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <div className={styles.eyebrow}>FluxNova Demo</div>
            <h1 className={styles.title}>Processed Results</h1>
            <p className={styles.subtitle}>
              All forms that have completed the Intelligent Form Processing pipeline.
            </p>
          </div>
          <div className={styles.headerLinks}>
            <Link to="/form-processing" className={styles.navLink}>Process a Form</Link>
            <Link to="/review-queue" className={styles.navLink}>Review Queue</Link>
            <Link to="/hub" className={styles.navLink}>← Hub</Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {loading && (
          <div className={styles.centred}>
            <div className={styles.spinner} /><span>Loading…</span>
          </div>
        )}

        {error && <div className={styles.errorBanner}>{error}</div>}

        {!loading && results?.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📋</div>
            <h3 className={styles.emptyTitle}>No results yet</h3>
            <p className={styles.emptySub}>Process a form to see results appear here.</p>
            <Link to="/form-processing" className={styles.emptyLink}>Process a form →</Link>
          </div>
        )}

        {results?.length > 0 && (
          <div className={`${styles.tableWrap} ${selectedRecord ? styles.withDrawer : ''}`}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Amount</th>
                    <th>Result</th>
                    <th>Path</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const v = r.fields || {};
                    const name   = v.applicantName?.value          || '—';
                    const type   = r.requestType || v.requestType?.value || '—';
                    const amount = r.amount      ?? v.amount?.value ?? null;
                    return (
                      <tr
                        key={r.processInstanceId}
                        className={`${styles.row} ${selected === r.processInstanceId ? styles.rowActive : ''}`}
                        onClick={() => setSelected(r.processInstanceId === selected ? null : r.processInstanceId)}
                      >
                        <td className={styles.tdName}>{name}</td>
                        <td><span className={styles.pill}>{type}</span></td>
                        <td>{r.category || '—'}</td>
                        <td><span className={`${styles.pill} ${priorityClass(r.priority)}`}>{r.priority || '—'}</span></td>
                        <td>{amount != null ? `$${Number(amount).toLocaleString()}` : '—'}</td>
                        <td className={styles.tdCalc}>{calcSummary(r.calculationResult)}</td>
                        <td>{r.wasReviewed ? '🔄' : '⚡'}</td>
                        <td className={styles.tdDate}>{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : '—'}</td>
                        <td><span className={styles.detailLink}>Detail →</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedRecord && (
              <DetailDrawer
                record={selectedRecord}
                onClose={() => setSelected(null)}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
