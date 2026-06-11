import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProcessTimeline from '../components/ProcessTimeline';
import { submitApplication } from '../services/api';
import styles from './ApplyPage.module.css';

const INITIAL = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  annualIncome: '',
  employmentStatus: '',
  monthlyExpenses: '',
  loanAmount: '',
  termMonths: '36',
  loanPurpose: '',
  notes: '',
};

function calcMonthlyPayment(amount, months, rate = 0.08) {
  const p = parseFloat(amount);
  const n = parseInt(months, 10);
  if (!p || !n) return null;
  const r = rate / 12;
  return (p * r) / (1 - Math.pow(1 + r, -n));
}

export default function ApplyPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const monthly = calcMonthlyPayment(form.loanAmount, form.termMonths);
  const total = monthly ? monthly * parseInt(form.termMonths, 10) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...form,
        loanAmount: parseFloat(form.loanAmount),
        termMonths: parseInt(form.termMonths, 10),
        annualIncome: parseFloat(form.annualIncome),
        monthlyExpenses: parseFloat(form.monthlyExpenses) || 0,
      };
      const res = await submitApplication(payload);
      navigate(`/status/${res.data.instanceId}`);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to submit application. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.layout}>
      <ProcessTimeline activeStep="apply" completedSteps={[]} />
      <div className={styles.main}>
        <div className={styles.formArea}>
          <header className={styles.docHeader}>
            <span className={styles.eyebrow}>LOAN DESK</span>
            <h1 className={styles.heading}>Loan Application</h1>
            <p className={styles.subheading}>
              Complete all sections below. Your application will be reviewed within 2 business days.
            </p>
          </header>

          {error && <div className={styles.errorBanner}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionIdx}>01</span>
                <span className={styles.sectionTitle}>Applicant</span>
              </div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>First Name</label>
                  <input className={styles.input} type="text" value={form.firstName}
                    onChange={set('firstName')} placeholder="Jane" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Last Name</label>
                  <input className={styles.input} type="text" value={form.lastName}
                    onChange={set('lastName')} placeholder="Smith" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Email Address</label>
                  <input className={styles.input} type="email" value={form.email}
                    onChange={set('email')} placeholder="jane@example.com" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Phone Number</label>
                  <input className={styles.input} type="tel" value={form.phone}
                    onChange={set('phone')} placeholder="+1 555 000 0000" />
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionIdx}>02</span>
                <span className={styles.sectionTitle}>Financial</span>
              </div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Annual Income ($)</label>
                  <input className={styles.input} type="number" value={form.annualIncome}
                    onChange={set('annualIncome')} placeholder="75000" min="0" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Employment Status</label>
                  <select className={styles.select} value={form.employmentStatus}
                    onChange={set('employmentStatus')} required>
                    <option value="">Select status…</option>
                    <option value="employed_full">Employed (Full-time)</option>
                    <option value="employed_part">Employed (Part-time)</option>
                    <option value="self_employed">Self-Employed</option>
                    <option value="unemployed">Unemployed</option>
                    <option value="retired">Retired</option>
                    <option value="student">Student</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Monthly Expenses ($)</label>
                  <input className={styles.input} type="number" value={form.monthlyExpenses}
                    onChange={set('monthlyExpenses')} placeholder="2500" min="0" />
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionIdx}>03</span>
                <span className={styles.sectionTitle}>Loan Request</span>
              </div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Loan Amount ($)</label>
                  <input className={styles.input} type="number" value={form.loanAmount}
                    onChange={set('loanAmount')} placeholder="25000" min="1000" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Term</label>
                  <select className={styles.select} value={form.termMonths} onChange={set('termMonths')}>
                    <option value="12">12 months (1 year)</option>
                    <option value="24">24 months (2 years)</option>
                    <option value="36">36 months (3 years)</option>
                    <option value="48">48 months (4 years)</option>
                    <option value="60">60 months (5 years)</option>
                  </select>
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label className={styles.label}>Loan Purpose</label>
                  <select className={styles.select} value={form.loanPurpose}
                    onChange={set('loanPurpose')} required>
                    <option value="">Select purpose…</option>
                    <option value="home_improvement">Home Improvement</option>
                    <option value="debt_consolidation">Debt Consolidation</option>
                    <option value="vehicle">Vehicle Purchase</option>
                    <option value="medical">Medical Expenses</option>
                    <option value="education">Education</option>
                    <option value="business">Business</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionIdx}>04</span>
                <span className={styles.sectionTitle}>Notes</span>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Additional Information</label>
                <textarea className={styles.textarea} value={form.notes} onChange={set('notes')}
                  rows={4} placeholder="Any additional context that may support your application…" />
              </div>
            </section>

            <div className={styles.actions}>
              <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>

        <aside className={styles.estimatePanel}>
          <span className={styles.panelEyebrow}>ESTIMATE</span>
          <h3 className={styles.panelTitle}>Monthly Breakdown</h3>
          <div className={styles.panelDivider} />
          <div className={styles.panelRow}>
            <span className={styles.panelKey}>Loan Amount</span>
            <span className={styles.panelVal}>
              {form.loanAmount ? `$${Number(form.loanAmount).toLocaleString()}` : '—'}
            </span>
          </div>
          <div className={styles.panelRow}>
            <span className={styles.panelKey}>Term</span>
            <span className={styles.panelVal}>{form.termMonths} months</span>
          </div>
          <div className={styles.panelDivider} />
          <div className={styles.panelRow}>
            <span className={styles.panelKey}>Est. Monthly</span>
            <span className={`${styles.panelVal} ${styles.panelHighlight}`}>
              {monthly ? `$${monthly.toFixed(2)}` : '—'}
            </span>
          </div>
          <div className={styles.panelRow}>
            <span className={styles.panelKey}>Total Repayment</span>
            <span className={styles.panelVal}>{total ? `$${total.toFixed(2)}` : '—'}</span>
          </div>
          <p className={styles.panelNote}>
            Estimate at 8% APR. Actual rate determined after credit review.
          </p>
        </aside>
      </div>
    </div>
  );
}
