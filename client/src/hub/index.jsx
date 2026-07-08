import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DEMOS, ALL_TAGS } from './demos';

function StatusBadge({ status }) {
  const label = status === 'coming-soon' ? 'Coming Soon'
    : status === 'in-progress' ? 'In Progress'
    : 'Live';
  return <span className={`hub-status ${status}`}>{label}</span>;
}

function DemoCard({ demo }) {
  return (
    <div className="hub-card">
      <div className={`hub-card-accent ${demo.status}`} />
      <div className="hub-card-body">
        <div className="hub-card-header">
          <h3 className="hub-card-title">{demo.title}</h3>
          <StatusBadge status={demo.status} />
        </div>
        <p className="hub-card-desc">{demo.description}</p>
        <div className="hub-card-tags">
          {demo.tags.map((t) => (
            <span key={t} className="hub-tag">{t}</span>
          ))}
        </div>
        <ul className="hub-card-highlights">
          {demo.highlights.slice(0, 3).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>
      <div className="hub-card-footer">
        <Link to={demo.route} className="hub-btn ghost" style={{ fontSize: '0.75rem' }}>
          View Details
        </Link>
        {demo.status === 'live' && demo.liveRoute ? (
          <Link to={demo.liveRoute} className="hub-btn">
            Launch ↗
          </Link>
        ) : (
          <span
            className="hub-btn"
            style={{ opacity: 0.4, cursor: 'default', fontSize: '0.75rem' }}
          >
            Coming Soon
          </span>
        )}
      </div>
    </div>
  );
}

export default function HubHome() {
  const [activeTag, setActiveTag] = useState('All');

  const filtered = activeTag === 'All'
    ? DEMOS
    : DEMOS.filter((d) => d.tags.includes(activeTag));

  return (
    <>
      {/* Hero */}
      <div className="hub-hero">
        <span className="hub-hero-eyebrow">FluxNova Innovation Lab</span>
        <h1 className="hub-hero-title">
          A living platform for process automation &amp; AI
        </h1>
        <p className="hub-hero-sub">
          Explore working demos that combine BPM orchestration, machine learning,
          and Lean Six Sigma principles. Each demo is a full-stack proof-of-concept
          you can fork, extend, and deploy.
        </p>
        <Link to="/hub/learn" className="hub-hero-cta">
          Learn FluxNova →
        </Link>
      </div>

      {/* Demo Library */}
      <div className="hub-content">
        <section className="hub-section">
          <div className="hub-section-head">
            <div className="hub-section-label">
              <span className="hub-section-idx">01</span>
              <span className="hub-section-title">Demo Library</span>
            </div>
            <span style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '0.65rem',
              color: 'var(--ink-muted)',
            }}>
              {filtered.length} demo{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Tag filter */}
          <div className="hub-filter-bar">
            {['All', ...ALL_TAGS].map((tag) => (
              <button
                key={tag}
                className={`hub-filter-pill${activeTag === tag ? ' active' : ''}`}
                onClick={() => setActiveTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Cards */}
          <div className="hub-card-grid">
            {filtered.map((demo) => (
              <DemoCard key={demo.id} demo={demo} />
            ))}
          </div>
        </section>
      </div>

      {/* About FluxNova */}
      <div id="about" className="hub-about">
        <div className="hub-about-inner">
          <div>
            <span className="hub-about-eyebrow">About</span>
            <h2 className="hub-about-title">What is FluxNova?</h2>
            <p className="hub-about-body">
              FluxNova is an open-source BPM (Business Process Management) platform
              built on the Camunda 7 engine. It lets you model processes visually in
              BPMN 2.0, evaluate business rules with DMN decision tables, and
              orchestrate both automated and human tasks — all via a clean REST API.
            </p>
            <p className="hub-about-body" style={{ marginTop: '-8px' }}>
              Every demo in this lab runs on a live FluxNova instance. The source code
              is structured so adding a new use case means dropping in a BPMN file and
              wiring a UI — the engine handles the rest.
            </p>
            <div className="hub-about-pills">
              {['BPMN 2.0', 'DMN', 'REST API', 'External Tasks', 'Cockpit', 'Lean-ready'].map((p) => (
                <span key={p} className="hub-about-pill">{p}</span>
              ))}
            </div>
          </div>
          <div className="hub-about-cta">
            <Link to="/hub/learn" className="hub-btn" style={{ fontSize: '0.9rem', padding: '12px 24px' }}>
              Interactive Learning →
            </Link>
            <Link to="/hub/demos/loan-approval" className="hub-btn ghost" style={{ fontSize: '0.9rem', padding: '12px 24px' }}>
              Explore the Live Demo
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
