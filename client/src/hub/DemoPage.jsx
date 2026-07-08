import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDemoById, getRelatedDemos } from './demos';

function FlowDiagram({ steps }) {
  return (
    <div className="hub-flow-wrap">
      <div className="hub-flow">
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div className="hub-flow-step">
              <div className="hub-flow-icon">{step.icon}</div>
              <div className="hub-flow-label">{step.label}</div>
            </div>
            {i < steps.length - 1 && (
              <div className="hub-flow-arrow">→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestModal({ demoTitle, onClose }) {
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    console.log('[Hub] Demo request:', { demo: demoTitle, note });
    setSent(true);
  };

  return (
    <div className="hub-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="hub-modal">
        {sent ? (
          <>
            <h3 className="hub-modal-title">Thanks for the interest! 🙌</h3>
            <p className="hub-modal-sub">
              Your request has been noted. We'll prioritize demos based on demand.
            </p>
            <div className="hub-modal-actions">
              <button className="hub-btn" onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <>
            <h3 className="hub-modal-title">Request: {demoTitle}</h3>
            <p className="hub-modal-sub">
              Tell us why this demo would be valuable to you or your team.
            </p>
            <textarea
              className="hub-modal-textarea"
              rows={4}
              placeholder="What use case are you trying to solve? Any specific tech stack preferences?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="hub-modal-actions">
              <button className="hub-btn ghost" onClick={onClose}>Cancel</button>
              <button className="hub-btn" onClick={handleSubmit}>Submit Request</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RelatedDemoCard({ demo }) {
  const statusLabel = demo.status === 'coming-soon' ? 'Coming Soon'
    : demo.status === 'in-progress' ? 'In Progress' : 'Live';
  return (
    <div className="hub-card">
      <div className={`hub-card-accent ${demo.status}`} />
      <div className="hub-card-body">
        <div className="hub-card-header">
          <h4 className="hub-card-title" style={{ fontSize: '0.9rem' }}>{demo.title}</h4>
          <span className={`hub-status ${demo.status}`}>{statusLabel}</span>
        </div>
        <p className="hub-card-desc" style={{ fontSize: '0.78rem' }}>
          {demo.description.slice(0, 100)}…
        </p>
        <div className="hub-card-tags">
          {demo.tags.slice(0, 3).map((t) => (
            <span key={t} className="hub-tag">{t}</span>
          ))}
        </div>
      </div>
      <div className="hub-card-footer">
        <Link to={demo.route} className="hub-btn ghost" style={{ fontSize: '0.75rem' }}>
          View →
        </Link>
      </div>
    </div>
  );
}

export default function DemoPage() {
  const { id } = useParams();
  const demo = getDemoById(id);
  const [showModal, setShowModal] = useState(false);

  if (!demo) {
    return (
      <div className="hub-content" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <p style={{ fontFamily: "'Space Mono', monospace", color: 'var(--ink-muted)', fontSize: '0.85rem' }}>
          Demo not found.
        </p>
        <Link to="/hub" className="hub-btn" style={{ marginTop: '16px' }}>
          ← Back to Library
        </Link>
      </div>
    );
  }

  const related = getRelatedDemos(demo);
  const isLive = demo.status === 'live';

  return (
    <>
      {/* Header band */}
      <div className="hub-demo-header">
        <div className="hub-demo-header-inner">
          <Link to="/hub" className="hub-demo-back">← Demo Library</Link>
          <h1 className="hub-demo-title">{demo.title}</h1>
          <p className="hub-demo-desc">{demo.description}</p>
          <div className="hub-demo-meta">
            <span className={`hub-status ${demo.status}`}>
              {demo.status === 'coming-soon' ? 'Coming Soon'
                : demo.status === 'in-progress' ? 'In Progress' : '● Live'}
            </span>
            {demo.tags.map((t) => (
              <span key={t} className="hub-tag" style={{ background: 'rgba(255,255,255,0.12)', color: 'var(--hub-teal-light)' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="hub-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>

          {/* Try it live / Request button */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {isLive && demo.liveRoute ? (
              <Link to={demo.liveRoute} className="hub-btn" style={{ fontSize: '0.9rem', padding: '10px 22px' }}>
                Try it live ↗
              </Link>
            ) : (
              <button className="hub-btn" onClick={() => setShowModal(true)} style={{ fontSize: '0.9rem', padding: '10px 22px' }}>
                Request this demo
              </button>
            )}
            <Link to="/hub" className="hub-btn ghost" style={{ fontSize: '0.9rem', padding: '10px 22px' }}>
              ← Back to Library
            </Link>
          </div>

          {/* How it works */}
          <section className="hub-section">
            <div className="hub-section-head">
              <div className="hub-section-label">
                <span className="hub-section-idx">01</span>
                <span className="hub-section-title">How it works</span>
              </div>
            </div>
            {demo.flowSteps && <FlowDiagram steps={demo.flowSteps} />}
            <div style={{ marginTop: '16px' }}>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {demo.highlights.map((h) => (
                  <li key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.875rem', color: 'var(--ink-mid)' }}>
                    <span style={{ color: 'var(--hub-teal)', fontWeight: 700, flexShrink: 0 }}>›</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Tech stack */}
          <section className="hub-section">
            <div className="hub-section-head">
              <div className="hub-section-label">
                <span className="hub-section-idx">02</span>
                <span className="hub-section-title">Tech stack</span>
              </div>
            </div>
            <div className="hub-tech-list">
              {demo.techStack.map((t) => (
                <span key={t} className="hub-tech-chip">{t}</span>
              ))}
            </div>
          </section>

          {/* Related demos */}
          {related.length > 0 && (
            <section className="hub-section">
              <div className="hub-section-head">
                <div className="hub-section-label">
                  <span className="hub-section-idx">03</span>
                  <span className="hub-section-title">Related demos</span>
                </div>
              </div>
              <div className="hub-related-grid">
                {related.map((d) => (
                  <RelatedDemoCard key={d.id} demo={d} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {showModal && (
        <RequestModal demoTitle={demo.title} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
