import {
  Activity,
  Bell,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  Map,
  Plus,
  ShieldCheck,
  CloudRain,
  Navigation,
  Video,
  UserRound,
  X,
} from 'lucide-react'

const navigation = [
  { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'peta', label: 'Peta pantauan', icon: Map },
  { id: 'laporan', label: 'Laporan terbaru', icon: Activity },
  { id: 'laporkan', label: 'Laporkan kejadian', icon: Plus },
  { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
  { id: 'cuaca', label: 'Cuaca', icon: CloudRain },
  { id: 'cctv', label: 'CCTV lalu lintas', icon: Video },
  { id: 'navigasi', label: 'Navigasi & rute', icon: Navigation },
  { id: 'profil', label: 'Profil pengguna', icon: UserRound },
]

function Sidebar({ activeSection, onNavigate, mobileOpen, onClose, notificationCount = 0 }) {
  return (
    <>
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Tutup menu" onClick={onClose} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">
            <Map size={22} strokeWidth={2.2} />
            <span><ShieldCheck size={11} strokeWidth={2.8} /></span>
          </div>
          <div className="brand-copy">
            <strong>KOPO SIAGA</strong>
            <span>Bandung Selatan</span>
          </div>
          <button className="sidebar-close plain-icon" aria-label="Tutup menu" onClick={onClose}><X size={19} /></button>
        </div>

        <div className="sidebar-area">
          <span className="nav-section-label">MENU UTAMA</span>
          <nav className="sidebar-nav" aria-label="Menu utama">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`nav-item ${activeSection === id ? 'active' : ''}`}
                onClick={() => onNavigate(id)}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{label}</span>
                {id === 'notifikasi' && notificationCount > 0 && <span className="nav-count">{notificationCount}</span>}
                {activeSection === id && <ChevronRight className="nav-chevron" size={15} />}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-spacer" />
        <div className="sidebar-safety-card">
          <div className="safety-card-icon"><ShieldCheck size={17} /></div>
          <strong>Utamakan keselamatan</strong>
          <p>Periksa kondisi perjalanan sebelum berangkat.</p>
          <button type="button" onClick={() => onNavigate('peta')}>Lihat peta <ChevronRight size={14} /></button>
        </div>
        <button className="sidebar-help" type="button" onClick={() => onNavigate('bantuan')}>
          <CircleHelp size={17} /> Bantuan & informasi
        </button>
        <div className="sidebar-version">VERSI 0.1.0 <span>•</span> PRA-TINJAU</div>
      </aside>
    </>
  )
}

export default Sidebar
