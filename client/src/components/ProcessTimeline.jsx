import { Link } from 'react-router-dom';
import styles from './ProcessTimeline.module.css';

const STEPS = [
  { key: 'apply', index: '01', label: 'Application' },
  { key: 'credit_check', index: '02', label: 'Credit Check' },
  { key: 'rate_decision', index: '03', label: 'Rate Decision' },
  { key: 'review', index: '04', label: 'Manager Review' },
  { key: 'decision', index: '05', label: 'Decision' },
];

export default function ProcessTimeline({ activeStep, completedSteps = [] }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.eyebrow}>LOAN DESK</span>
        <span className={styles.brandName}>Fluxnova</span>
      </div>

      <nav className={styles.nav}>
        {STEPS.map((step, i) => {
          const isActive = step.key === activeStep;
          const isDone = completedSteps.includes(step.key);
          const cls = [
            styles.step,
            isActive ? styles.active : '',
            isDone ? styles.done : '',
          ].filter(Boolean).join(' ');

          return (
            <div key={step.key} className={cls}>
              <div className={styles.track}>
                <div className={styles.dot} />
                {i < STEPS.length - 1 && <div className={styles.line} />}
              </div>
              <div className={styles.text}>
                <span className={styles.idx}>{step.index}</span>
                <span className={styles.stepLabel}>{step.label}</span>
              </div>
            </div>
          );
        })}
      </nav>

      <footer className={styles.footer}>
        <Link to="/manager" className={styles.managerLink}>Manager Portal →</Link>
        <Link to="/ops" className={styles.opsLink}>Ops Dashboard →</Link>
        <Link to="/hub" className={styles.hubLink}>Learning Hub →</Link>
      </footer>
    </aside>
  );
}
