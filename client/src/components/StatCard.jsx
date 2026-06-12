import { useEffect, useRef, useState } from 'react';
import styles from './StatCard.module.css';

function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target == null || isNaN(Number(target))) {
      setValue(target);
      return;
    }
    const end = Number(target);
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * end));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

export default function StatCard({ value, label, accent, icon, subValue, isPercent }) {
  const numericTarget = typeof value === 'number' ? value : null;
  const counted = useCountUp(numericTarget);

  const displayValue = numericTarget !== null
    ? (isPercent ? `${counted.toFixed(1)}%` : counted)
    : value;

  return (
    <div className={styles.card}>
      <div className={styles.accentBar} style={{ background: accent }} />
      <div className={styles.body}>
        <div className={styles.iconWrap} style={{ color: accent }}>{icon}</div>
        <div className={styles.valueWrap}>
          <span className={styles.value}>{displayValue ?? '—'}</span>
          <span className={styles.label}>{label}</span>
          {subValue && <span className={styles.subValue}>{subValue}</span>}
        </div>
      </div>
    </div>
  );
}
