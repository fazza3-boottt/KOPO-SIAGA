import { ArrowUpRight } from 'lucide-react'

function StatCard({ label, count, note, icon: Icon, tone }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <div className="stat-top">
        <span className={`stat-icon tone-${tone}`}><Icon size={18} strokeWidth={2} /></span>
        <span className="stat-period"><ArrowUpRight size={13} /> 24 jam</span>
      </div>
      <div className="stat-value">{count}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-note"><span className={`status-pip pip-${tone}`} />{note}</div>
    </article>
  )
}

export default StatCard
