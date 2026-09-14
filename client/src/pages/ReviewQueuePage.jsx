import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getReviewTasks, submitReview } from '../services/api';
import { FORM_FIELDS } from '../config/formFields';
import styles from './ReviewQueuePage.module.css';

function confidenceColor(c) {
  if (c >= 0.85) return '#166534';
  if (c >= 0.6)  return '#92703a';
  return '#b91c1c';
}

function confidenceBg(c) {
  if (c >= 0.85) return '#f0fdf4';
  if (c >= 0.6)  return '#fffbf0';
  return '#fef2f2';
}

function ConfidenceBadge({ value }) {
  const pct = Math.round((value ?? 0) * 100);
  return (
    <span
      className={styles.confBadge}
      style={{ color: confidenceColor(value), background: confidenceBg(value) }}
    >
      {pct}%
    </span>
  );
}

function ReviewPanel({ task, onSubmitted }) {
  const [fields, setFields] = useState(() => {
    const init = {};
    FORM_FIELDS.forEach((f) => {
      init[f.name] = String(task.extractedFields?.[f.name]?.value ?? '');
    });
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const firstLowRef = useRef(null);

  // Autofocus first low-confidence field
  useEffect(() => {
    setTimeout(() => firstLowRef.current?.focus(), 80);
  }, [task.taskId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitReview(task.taskId, fields);
      onSubmitted(task.taskId);
    } catch (err) {
      setError(err.response?.data?.error || 'Submit failed');
      setSubmitting(false);
    }
  };

  const isLow = (name) => task.lowConfidenceFields?.includes(name);

  return (
    <div className={styles.reviewPanel}>
      <div className={styles.panelSplit}>
        {/* Left: form image */}
        <div className={styles.imagePane}>
          {task.documentId ? (
            <img
              src={`/api/forms/document/${task.documentId}`}
              alt="Form"
              className={styles.formImage}
            />
          ) : (
            <div className={styles.noImage}>No image available</div>
          )}
          <p className={styles.imageCaption}>{task.originalFilename}</p>
        </div>

        {/* Right: editable fields */}
        <form className={styles.fieldPane} onSubmit={handleSubmit}>
          <h3 className={styles.fieldPaneTitle}>Correct extracted fields</h3>
          <p className={styles.fieldPaneSub}>
            Fields below 85% confidence are highlighted. Edit any incorrect value then submit.
          </p>

          {FORM_FIELDS.map((f) => {
            const conf = task.extractedFields?.[f.name]?.confidence ?? null;
            const low  = isLow(f.name);
            return (
              <div key={f.name} className={`${styles.fieldRow} ${low ? styles.fieldLow : ''}`}>
                <div className={styles.fieldHeader}>
                  <label className={styles.fieldLabel} htmlFor={`field-${f.name}`}>
                    {f.label}
                  </label>
                  {conf !== null && <ConfidenceBadge value={conf} />}
                </div>
                <input
                  id={`field-${f.name}`}
                  ref={low && !firstLowRef.current ? firstLowRef : null}
                  className={`${styles.fieldInput} ${low ? styles.fieldInputLow : ''}`}
                  value={fields[f.name]}
                  onChange={(e) => setFields((prev) => ({ ...prev, [f.name]: e.target.value }))}
                />
              </div>
            );
          })}

          {error && <p className={styles.submitError}>{error}</p>}

          <div className={styles.submitRow}>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReviewQueuePage() {
  const [tasks, setTasks] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getReviewTasks();
      setTasks(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTasks(); }, []);

  const handleSubmitted = (taskId) => {
    setSelected(null);
    setTasks((prev) => prev?.filter((t) => t.taskId !== taskId));
  };

  const selectedTask = tasks?.find((t) => t.taskId === selected);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <div className={styles.eyebrow}>FluxNova Demo</div>
            <h1 className={styles.title}>Review Queue</h1>
            <p className={styles.subtitle}>
              Forms where the AI extracted fields below the confidence threshold. Correct and submit each task.
            </p>
          </div>
          <div className={styles.headerLinks}>
            <Link to="/form-processing" className={styles.navLink}>Form Processing</Link>
            <Link to="/results" className={styles.navLink}>Results</Link>
            <Link to="/hub" className={styles.navLink}>← Hub</Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {loading && (
          <div className={styles.centred}>
            <div className={styles.spinner} />
            <span>Loading tasks…</span>
          </div>
        )}

        {error && <div className={styles.errorBanner}>{error}</div>}

        {!loading && tasks?.length === 0 && !selectedTask && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>✅</div>
            <h3 className={styles.emptyTitle}>Queue is clear</h3>
            <p className={styles.emptySub}>
              No forms are waiting for review. Upload a messy sample to see this queue in action.
            </p>
            <Link to="/form-processing" className={styles.emptyLink}>Upload a form →</Link>
          </div>
        )}

        {!loading && tasks?.length > 0 && (
          <div className={styles.layout}>
            {/* Task list */}
            <aside className={styles.taskList}>
              <div className={styles.taskListHeader}>
                <span className={styles.taskCount}>{tasks.length} pending</span>
                <button className={styles.refreshBtn} onClick={loadTasks}>↻</button>
              </div>
              {tasks.map((task) => (
                <button
                  key={task.taskId}
                  className={`${styles.taskItem} ${selected === task.taskId ? styles.taskItemActive : ''}`}
                  onClick={() => setSelected(task.taskId)}
                >
                  <div className={styles.taskName}>{task.originalFilename || 'Form'}</div>
                  <div className={styles.taskMeta}>
                    {task.lowConfidenceFields?.length > 0 && (
                      <span className={styles.lowBadge}>
                        {task.lowConfidenceFields.length} low
                      </span>
                    )}
                    <span className={styles.taskDate}>
                      {task.created ? new Date(task.created).toLocaleTimeString() : ''}
                    </span>
                  </div>
                </button>
              ))}
            </aside>

            {/* Review panel */}
            <div className={styles.panelWrap}>
              {selectedTask ? (
                <ReviewPanel task={selectedTask} onSubmitted={handleSubmitted} />
              ) : (
                <div className={styles.selectPrompt}>
                  ← Select a task to review
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
