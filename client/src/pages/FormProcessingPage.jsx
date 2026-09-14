import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { uploadForm, getFormStatus } from '../services/api';
import styles from './FormProcessingPage.module.css';

// ── Stage definitions ─────────────────────────────────────────────────────────

const STAGES = [
  { key: 'extracting',         label: 'Extract',    icon: '🤖' },
  { key: 'review',             label: 'Review',     icon: '👤' },
  { key: 'triage/calculating', label: 'Triage',     icon: '📊' },
  { key: 'triage/calculating', label: 'Calculate',  icon: '⚙️' },
  { key: 'completed',          label: 'Stored',     icon: '✅' },
];

function stageIndex(apiStage) {
  if (apiStage === 'extracting')        return 0;
  if (apiStage === 'review')            return 1;
  if (apiStage === 'triage/calculating') return 3;
  if (apiStage === 'completed')         return 5; // past all
  return 0;
}

// ── Stage tracker ─────────────────────────────────────────────────────────────

function StageTracker({ status }) {
  const current = stageIndex(status.stage);
  const skippedReview = status.variables?.needsReview === false &&
    ['triage/calculating', 'completed'].includes(status.stage);

  return (
    <div className={styles.tracker}>
      {STAGES.map((s, i) => {
        const done    = current > i;
        const active  = current === i;
        const isReview = i === 1;

        return (
          <div key={i} className={styles.trackerItem}>
            {i > 0 && <div className={`${styles.trackerLine} ${done || (current >= i) ? styles.lineActive : ''}`} />}
            <div className={`${styles.trackerNode} ${done ? styles.nodeDone : active ? styles.nodeActive : ''}`}>
              <span className={styles.nodeIcon}>{done ? '✓' : s.icon}</span>
            </div>
            <div className={styles.trackerLabel}>
              {s.label}
              {isReview && skippedReview && (
                <span className={styles.skippedBadge}>Skipped</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Result summary ────────────────────────────────────────────────────────────

function ResultSummary({ status }) {
  const v = status.variables || {};
  const calc = v.calculationResult;

  function calcLine() {
    if (!calc) return null;
    if (calc.type === 'loan')
      return `$${calc.monthlyPayment?.toFixed(2)}/mo over ${calc.months} months (fee $${calc.fee?.toFixed(2)})`;
    if (calc.type === 'refund')
      return `Net refund $${calc.netRefund?.toFixed(2)} (fee $${calc.fee?.toFixed(2)})`;
    return `Flat processing fee $${calc.flatProcessingFee?.toFixed(2)}`;
  }

  return (
    <div className={styles.resultCard}>
      <div className={styles.resultBadge}>✅ Processing Complete</div>
      <div className={styles.resultGrid}>
        {v.applicantName  && <><span className={styles.rLabel}>Applicant</span>    <span>{v.applicantName}</span></>}
        {v.requestType    && <><span className={styles.rLabel}>Type</span>          <span className={styles.pill}>{v.requestType}</span></>}
        {v.amount != null && <><span className={styles.rLabel}>Amount</span>        <span>${Number(v.amount).toLocaleString()}</span></>}
        {v.category       && <><span className={styles.rLabel}>Category</span>      <span className={styles.pill}>{v.category}</span></>}
        {v.priority       && <><span className={styles.rLabel}>Priority</span>      <span className={`${styles.pill} ${styles[`p_${v.priority}`] || ''}`}>{v.priority}</span></>}
        {calcLine()       && <><span className={styles.rLabel}>Calculation</span>   <span>{calcLine()}</span></>}
        <span className={styles.rLabel}>Path</span>
        <span>{status.variables?.needsReview ? '🔄 Reviewed' : '⚡ Straight-through'}</span>
      </div>
      <div className={styles.resultActions}>
        <Link to="/results" className={styles.btnPrimary}>View all results →</Link>
        <button className={styles.btnGhost} onClick={() => window.location.reload()}>Process another</button>
      </div>
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({ onFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const loadSample = async (filename) => {
    const res = await fetch(`/samples/${filename}`);
    const blob = await res.blob();
    onFile(new File([blob], filename, { type: blob.type }));
  };

  return (
    <div className={styles.uploadSection}>
      <div
        className={`${styles.dropZone} ${dragging ? styles.dragging : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
        />
        <div className={styles.dropIcon}>📄</div>
        <p className={styles.dropTitle}>Drop a form here or click to browse</p>
        <p className={styles.dropSub}>JPG · PNG · PDF — up to 15 MB</p>
      </div>

      <div className={styles.sampleRow}>
        <span className={styles.sampleLabel}>Try a sample:</span>
        <button className={styles.sampleBtn} onClick={() => loadSample('clean-form.png')}>
          Clean form <span className={styles.sampleTag}>→ straight-through</span>
        </button>
        <button className={styles.sampleBtn} onClick={() => loadSample('handwritten-review.png')}>
          Handwritten form <span className={styles.sampleTag}>→ triggers review</span>
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FormProcessingPage() {
  const [uploading, setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [instanceId, setInstanceId] = useState(null);
  const [status, setStatus]         = useState(null);
  const pollRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    setUploadError(null);
    setUploading(true);
    try {
      const res = await uploadForm(file);
      setInstanceId(res.data.processInstanceId);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed. Is the server running?');
    } finally {
      setUploading(false);
    }
  }, []);

  useEffect(() => {
    if (!instanceId) return;
    let mounted = true;

    async function poll() {
      try {
        const res = await getFormStatus(instanceId);
        if (!mounted) return;
        setStatus(res.data);
        if (res.data.stage === 'completed') clearInterval(pollRef.current);
      } catch {}
    }

    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => {
      mounted = false;
      clearInterval(pollRef.current);
    };
  }, [instanceId]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <div className={styles.eyebrow}>FluxNova Demo</div>
            <h1 className={styles.title}>Intelligent Form Processing</h1>
            <p className={styles.subtitle}>
              Upload any form image or PDF. The AI extracts fields automatically and routes low-confidence results for human review.
            </p>
          </div>
          <div className={styles.headerLinks}>
            <Link to="/review-queue" className={styles.navLink}>Review Queue</Link>
            <Link to="/results" className={styles.navLink}>Results</Link>
            <Link to="/hub" className={styles.navLink}>← Hub</Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {!instanceId && !uploading && (
          <DropZone onFile={handleFile} />
        )}

        {uploading && (
          <div className={styles.uploadingState}>
            <div className={styles.spinner} />
            <p>Uploading and starting process…</p>
          </div>
        )}

        {uploadError && (
          <div className={styles.errorBanner}>
            {uploadError}
            <button className={styles.errorDismiss} onClick={() => setUploadError(null)}>×</button>
          </div>
        )}

        {instanceId && (
          <div className={styles.pipelineCard}>
            <div className={styles.pipelineHeader}>
              <h2 className={styles.pipelineTitle}>Pipeline</h2>
              <span className={styles.instanceId}>{instanceId}</span>
            </div>

            {!status && (
              <div className={styles.loadingRow}>
                <div className={styles.spinner} /> Starting…
              </div>
            )}

            {status && <StageTracker status={status} />}

            {status?.stage === 'review' && (
              <div className={styles.reviewBanner}>
                <span>⚠️ One or more fields need human review.</span>
                <Link to="/review-queue" className={styles.reviewLink}>Open Review Queue →</Link>
              </div>
            )}

            {status?.stage === 'completed' && <ResultSummary status={status} />}
          </div>
        )}
      </main>
    </div>
  );
}
