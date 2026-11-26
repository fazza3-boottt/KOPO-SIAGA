import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  CloudRain,
  Construction,
  Droplets,
  ExternalLink,
  Map,
  MapPin,
  Menu,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  TrafficCone,
  X,
} from 'lucide-react'
import IncidentMap from './components/IncidentMap.jsx'
import ReportDialog from './components/ReportDialog.jsx'
import Sidebar from './components/Sidebar.jsx'
import StatCard from './components/StatCard.jsx'
import PublicPages from './components/PublicPages.jsx'
import { mapReport, supabase } from './lib/supabase.js'
import { fetchWeatherForecast, weatherLocations } from './lib/weather.js'

const categories = [
  { id: 'banjir', label: 'Banjir', icon: Droplets, tone: 'blue' },
  { id: 'macet', label: 'Kemacetan', icon: TrafficCone, tone: 'orange' },
  { id: 'rusak', label: 'Jalan rusak', icon: Construction, tone: 'yellow' },
  { id: 'tutup', label: 'Jalan ditutup', icon: AlertTriangle, tone: 'red' },
  { id: 'kecelakaan', label: 'Kecelakaan', icon: AlertTriangle, tone: 'red' },
]

const regions = ['Semua wilayah', 'Bandung Kiwari', 'Cigondewah', 'TKI', 'Kopo', 'Margahayu', 'Katapang']
const reportStorageKey = 'kopo-siaga-reports'
const readReportsStorageKey = 'kopo-siaga-read-reports'

function readStoredReports() {
  try {
    const stored = window.localStorage.getItem(reportStorageKey)
    if (!stored) return { reports: [], error: '' }
    const reports = JSON.parse(stored)
    if (!Array.isArray(reports) || reports.some((report) =>
      !report || typeof report.id !== 'string' || typeof report.address !== 'string' ||
      typeof report.description !== 'string' || !categories.some(({ id }) => id === report.category),
    )) throw new Error('Format data laporan tidak sesuai.')
    return { reports, error: '' }
  } catch {
    return {
      reports: [],
      error: 'Data laporan lokal tidak dapat dibaca. Laporan baru mungkin tidak tersimpan setelah halaman ditutup.',
    }
  }
}

function readStoredReadReports(reports, hasBackend) {
  try {
    const stored = window.localStorage.getItem(readReportsStorageKey)
    if (stored !== null) {
      const ids = JSON.parse(stored)
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
        throw new Error('Format status baca notifikasi tidak sesuai.')
      }
      return { ids, initialized: true }
    }
    return {
      ids: hasBackend ? [] : reports.map(({ id }) => id),
      initialized: !hasBackend,
    }
  } catch {
    return {
      ids: hasBackend ? [] : reports.map(({ id }) => id),
      initialized: !hasBackend,
    }
  }
}

function getReportLabel(categoryId) {
  return categories.find(({ id }) => id === categoryId)?.label.toLowerCase() || 'gangguan jalan'
}

function getSafetyAdvice(report) {
  if (report.category === 'banjir') return 'Hindari menerobos genangan. Periksa kondisi jalan sekitar sebelum melanjutkan perjalanan.'
  if (report.category === 'macet') return 'Pertimbangkan menunda perjalanan atau mencari jalan sekitar melalui aplikasi navigasi.'
  if (report.category === 'rusak') return 'Kurangi kecepatan dan waspadai kondisi permukaan jalan.'
  return 'Jangan memasuki ruas yang ditutup; ikuti rambu dan arahan petugas.'
}

function getNearbyRoadSearch(report) {
  const query = encodeURIComponent(`jalan alternatif dekat ${report.address}`)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

function getTimeGreeting() {
  const hour = new Date().getHours()
  if (hour >= 4 && hour < 11) return 'Selamat pagi'
  if (hour >= 11 && hour < 15) return 'Selamat siang'
  if (hour >= 15 && hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

function announceReport(report) {
  const message = `PERINGATAN! Ada laporan warga tentang ${getReportLabel(report.category)} di jalan ${report.address}.`
  if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
    window.speechSynthesis.cancel()
    const announcement = new SpeechSynthesisUtterance(message)
    announcement.lang = 'id-ID'
    announcement.rate = 0.95
    window.speechSynthesis.speak(announcement)
  }
  if (typeof navigator.vibrate === 'function') navigator.vibrate([300, 120, 300])
}

function notifyDevice(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/vite.svg' })
  }
}

function getTimeOfDay(date) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: 'Asia/Jakarta',
  }).format(date))
  if (hour < 5 || hour >= 19) return 'night'
  if (hour < 8) return 'morning'
  if (hour < 16) return 'day'
  return 'evening'
}

function getWeatherKind(description = '') {
  if (/hujan|gerimis|petir|badai/i.test(description)) return 'rain'
  if (/cerah/i.test(description)) return 'clear'
  if (/berawan|awan/i.test(description)) return 'cloudy'
  return 'cloudy'
}

function App() {
  const [storedReportData] = useState(readStoredReports)
  const [storedReadReportData] = useState(() => readStoredReadReports(storedReportData.reports, Boolean(supabase)))
  const [readReportIds, setReadReportIds] = useState(() => new Set(storedReadReportData.ids))
  const readReportStateInitialized = useRef(storedReadReportData.initialized)
  const readReportStorageErrorShown = useRef(false)
  const [activeSection, setActiveSection] = useState('dashboard')
  const [selectedCategories, setSelectedCategories] = useState(categories.map(({ id }) => id))
  const [selectedRegion, setSelectedRegion] = useState(regions[0])
  const [isRegionOpen, setIsRegionOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState(supabase ? 'connecting' : 'local')
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const [toast, setToast] = useState(storedReportData.error)
  const [reports, setReports] = useState(storedReportData.reports)
  const [activeAlert, setActiveAlert] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [weatherLocation, setWeatherLocation] = useState(() => {
    const savedLocation = window.localStorage.getItem('kopo-siaga-weather-location')
    return weatherLocations.some(({ id }) => id === savedLocation) ? savedLocation : weatherLocations[0].id
  })
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(true)
  const [weatherError, setWeatherError] = useState('')
  const [weatherRetry, setWeatherRetry] = useState(0)
  const [currentTime, setCurrentTime] = useState(() => new Date())

  const showToast = useCallback((message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 5000)
  }, [])

  const unreadReportCount = reports.reduce(
    (count, report) => count + (readReportIds.has(report.id) ? 0 : 1),
    0,
  )

  const markReportsAsRead = useCallback(() => {
    const nextReadReportIds = new Set(readReportIds)
    reports.forEach(({ id }) => nextReadReportIds.add(id))
    setReadReportIds(nextReadReportIds)
  }, [readReportIds, reports])

  const timeOfDay = getTimeOfDay(currentTime)
  const weatherKind = getWeatherKind(weather?.current?.weather_desc)

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!readReportStateInitialized.current) return
    try {
      window.localStorage.setItem(readReportsStorageKey, JSON.stringify([...readReportIds]))
    } catch {
      if (!readReportStorageErrorShown.current) {
        showToast('Status notifikasi terbaca tidak dapat disimpan di browser ini.')
        readReportStorageErrorShown.current = true
      }
    }
  }, [readReportIds, showToast])

  useEffect(() => {
    const controller = new AbortController()
    const refreshTimer = window.setInterval(() => {
      setWeatherRetry((current) => current + 1)
    }, 6 * 60 * 60 * 1000)
    setWeatherLoading(true)
    setWeatherError('')

    fetchWeatherForecast(weatherLocation, controller.signal)
      .then(setWeather)
      .catch((error) => {
        if (error.name !== 'AbortError') setWeatherError(error.message || 'Prakiraan cuaca gagal dimuat.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setWeatherLoading(false)
      })

    return () => {
      controller.abort()
      window.clearInterval(refreshTimer)
    }
  }, [weatherLocation, weatherRetry])

  useEffect(() => {
    if (!supabase) {
      setRealtimeStatus('local')
      return undefined
    }

    let active = true
    let realtimeReports = []
    supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          showToast(`Laporan bersama gagal dimuat: ${error.message}`)
          return
        }
        if (!readReportStateInitialized.current) {
          const previouslyLoadedIds = new Set(realtimeReports.map(({ id }) => id))
          setReadReportIds(new Set(data
            .map(mapReport)
            .filter(({ id }) => !previouslyLoadedIds.has(id))
            .map(({ id }) => id)))
          readReportStateInitialized.current = true
        }
        const latestReports = [...data.map(mapReport), ...realtimeReports]
        setReports([...new Map(latestReports.map((report) => [report.id, report])).values()]
          .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)))
      })

    const channel = supabase
      .channel('kopo-siaga-reports')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (change) => {
        const report = mapReport(change.new)
        realtimeReports = [report, ...realtimeReports.filter((item) => item.id !== report.id)]
        setReports((current) => [
          report,
          ...current.filter((item) => item.id !== report.id),
        ].sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)))
        showToast(`Laporan baru dari warga: ${getReportLabel(report.category)} di ${report.address}.`)
        notifyDevice('Laporan jalan baru', `${getReportLabel(report.category)} · ${report.address}`)
      })
      .subscribe((status) => {
        if (!active) return
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('disconnected')
          showToast('Koneksi notifikasi lintas perangkat terputus. Memeriksa koneksi kembali...')
        } else setRealtimeStatus('connecting')
      })

    return () => {
      active = false
      setRealtimeStatus('connecting')
      supabase.removeChannel(channel)
    }
  }, [showToast])

  const notifyComingSoon = (name) => {
    showToast(`${name} akan tersedia pada tahap pengembangan berikutnya.`)
  }

  const submitReport = async (report) => {
    let savedReport = report
    if (supabase) {
      const { data, error } = await supabase
        .from('reports')
        .insert({
          category: report.category,
          title: report.title,
          address: report.address,
          description: report.description,
          created_at: report.createdAt,
          incident_at: report.incidentAt,
          severity: report.severity,
          lat: report.lat,
          lng: report.lng,
          location_note: report.locationNote,
        })
        .select()
        .single()
      if (error) throw new Error(`Laporan gagal dikirim ke server: ${error.message}`)
      savedReport = mapReport(data)
      setReports((current) => [savedReport, ...current.filter((item) => item.id !== savedReport.id)])
      showToast(savedReport.locationNote || 'Laporan berhasil dibagikan kepada pengguna.')
    } else {
      const nextReports = [report, ...reports]
      setReports(nextReports)
      try {
        window.localStorage.setItem(reportStorageKey, JSON.stringify(nextReports))
        showToast(report.locationNote || 'Laporan tersimpan di browser ini.')
      } catch {
        showToast('Laporan tampil selama sesi ini, tetapi tidak dapat disimpan di browser.')
      }
    }
    setActiveAlert(savedReport)
    setIsReportOpen(false)
    announceReport(savedReport)
    window.setTimeout(() => {
      document.getElementById('peringatan-terbaru')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  const enableDeviceNotifications = async () => {
    if (typeof Notification === 'undefined') {
      showToast('Browser ini tidak mendukung notifikasi perangkat.')
      return
    }
    try {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
      if (permission === 'granted') showToast('Notifikasi perangkat berhasil diaktifkan.')
      else showToast('Izin notifikasi perangkat belum diberikan.')
    } catch (error) {
      showToast(`Browser gagal mengaktifkan notifikasi: ${error.message}`)
    }
  }

  const toggleCategory = (categoryId) => {
    setSelectedCategories((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    )
  }

  const openReporterDialog = () => {
    setIsReportOpen(true)
  }

  return (
    <div className="app-shell" data-time={timeOfDay} data-weather={weatherKind}>
      <Sidebar
        activeSection={activeSection}
        notificationCount={unreadReportCount}
        onNavigate={(section) => {
          setActiveSection(section)
          setIsMobileMenuOpen(false)
          if (section === 'peta') document.getElementById('peta')?.scrollIntoView({ behavior: 'smooth' })
          if (section === 'laporan') document.getElementById('laporan-terbaru')?.scrollIntoView({ behavior: 'smooth' })
          if (section === 'notifikasi') {
            markReportsAsRead()
            setIsNotificationOpen(true)
          }
          if (section === 'laporkan') openReporterDialog()
          if (section === 'bantuan') notifyComingSoon('Bantuan & informasi')
        }}
        mobileOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <main className="main-content">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu-button icon-button"
            aria-label="Buka menu"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div className="topbar-actions">
            <span
              className={`live-indicator ${realtimeStatus === 'connected' ? 'sync-connected' : realtimeStatus === 'local' ? 'sync-local' : 'sync-disconnected'}`}
              title={realtimeStatus === 'local'
                ? 'Laporan belum dibagikan lintas perangkat. Atur Supabase untuk mengaktifkan notifikasi bersama.'
                : realtimeStatus === 'connected'
                  ? 'Notifikasi laporan tersambung untuk semua pengunjung yang sedang membuka situs.'
                  : 'Sedang menyambungkan notifikasi laporan lintas perangkat.'}
            >
              <i /> {realtimeStatus === 'connected'
                ? 'Realtime aktif'
                : realtimeStatus === 'local'
                  ? 'Mode lokal'
                  : realtimeStatus === 'disconnected'
                    ? 'Realtime terputus'
                    : 'Menghubungkan'}
            </span>
            <div className="notification-wrap">
              <button
                type="button"
                className={`icon-button notification-button ${isNotificationOpen ? 'is-active' : ''}`}
                aria-label="Buka notifikasi"
                aria-expanded={isNotificationOpen}
                onClick={() => {
                  if (!isNotificationOpen) markReportsAsRead()
                  setIsNotificationOpen((open) => !open)
                }}
              >
                <Bell size={19} />
                {unreadReportCount > 0 && <span className="notification-count">{unreadReportCount}</span>}
              </button>
              {isNotificationOpen && (
                <div className="notification-popover">
                  <div className="popover-heading">
                    <div><strong>Notifikasi</strong><span>{supabase ? 'Laporan bersama dari semua perangkat' : 'Informasi laporan di browser ini'}</span></div>
                    <button className="plain-icon" aria-label="Tutup notifikasi" onClick={() => setIsNotificationOpen(false)}><X size={17} /></button>
                  </div>
                  {reports.length === 0 ? (
                    <div className="notification-empty">
                      <span className="empty-icon"><Bell size={18} /></span>
                      <strong>Belum ada notifikasi</strong>
                      <p>{supabase ? 'Notifikasi laporan warga akan muncul di sini.' : 'Atur Supabase untuk menerima laporan dari perangkat lain.'}</p>
                    </div>
                  ) : (
                    <div className="notification-list">
                      {reports.slice(0, 5).map((report) => (
                        <div className="notification-item" key={report.id}>
                          <span className={`notification-item-icon tone-${categories.find(({ id }) => id === report.category)?.tone || 'orange'}`}><AlertTriangle size={15} /></span>
                          <span><strong>Laporan warga · {getReportLabel(report.category)}</strong><small>{report.address}</small></span>
                        </div>
                      ))}
                    </div>
                  )}
                  {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
                    <button type="button" className="enable-notifications-button" onClick={enableDeviceNotifications}>Aktifkan notifikasi perangkat</button>
                  )}
                </div>
              )}
            </div>
            <span className="profile-chip" aria-label="Mode publik">
              <span className="profile-avatar">P</span>
              <span className="profile-name">Publik</span>
            </span>
          </div>
        </header>

        <div className="page-content">
          {['notifikasi', 'cuaca', 'cctv', 'navigasi', 'profil'].includes(activeSection) ? (
            <>
              <PublicPages
                section={activeSection}
                reports={reports}
                showToast={showToast}
                notificationPermission={notificationPermission}
                onEnableNotifications={enableDeviceNotifications}
                weather={weather}
                weatherLoading={weatherLoading}
                weatherError={weatherError}
                weatherLocations={weatherLocations}
                selectedWeatherLocation={weatherLocation}
                onWeatherLocationChange={(locationId) => {
                  setWeatherLocation(locationId)
                  window.localStorage.setItem('kopo-siaga-weather-location', locationId)
                }}
                onWeatherRetry={() => setWeatherRetry((current) => current + 1)}
              />
              <footer className="page-footer">
                <span>KOPO SIAGA <span className="footer-dot">·</span> Kabupaten Bandung</span>
                <span>Informasi laporan masyarakat bukan pengganti informasi resmi pemerintah.</span>
              </footer>
            </>
          ) : (
          <>
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><MapPin size={14} /> KABUPATEN BANDUNG</div>
              <h1>{getTimeGreeting()}, Warga KOPO SIAGA!</h1>
              <p className="welcome-description">Sudah siap memulai perjalanan hari ini? Periksa kondisi jalan dan cuaca sebelum berangkat.</p>
            </div>
            <div className="welcome-actions">
              <button type="button" className="report-open-button" onClick={openReporterDialog}>
                <Plus size={16} /> Laporkan kejadian
              </button>
              <div className="updated-chip">
                <Clock3 size={15} />
                <span>Pembaruan data</span>
                <strong>{reports.length ? (supabase ? 'Data bersama' : 'Laporan lokal') : (supabase ? 'Realtime aktif' : 'Belum tersedia')}</strong>
              </div>
            </div>
          </section>

          <section className="stats-grid" aria-label="Ringkasan laporan">
            {categories.map(({ id, label, icon, tone }) => {
              const count = reports.filter((report) =>
                report.category === id && Date.now() - new Date(report.createdAt).getTime() < 24 * 60 * 60 * 1000,
              ).length
              return (
                <StatCard
                  key={id}
                  label={id === 'banjir' ? 'Banjir & genangan' : label}
                  count={count || '—'}
                  note={count ? 'Laporan warga · tampil langsung' : 'Belum ada laporan'}
                  icon={icon}
                  tone={tone}
                />
              )
            })}
          </section>

          {activeAlert && (
            <section className="report-alert" id="peringatan-terbaru" role="alert">
              <span className="report-alert-icon"><AlertTriangle size={19} /></span>
              <div className="report-alert-copy">
                <strong>PERINGATAN! Ada laporan {getReportLabel(activeAlert.category)} di jalan {activeAlert.address}.</strong>
                <p>{getSafetyAdvice(activeAlert)} Informasi ini dibagikan warga dan tidak diperiksa admin; pastikan kondisi terkini.</p>
                {activeAlert.locationNote && <small>{activeAlert.locationNote}</small>}
                <a href={getNearbyRoadSearch(activeAlert)} target="_blank" rel="noreferrer">
                  Cari jalan sekitar di Google Maps <ExternalLink size={14} />
                </a>
                <small className="route-disclaimer">Pencarian ini bukan rute alternatif terverifikasi; periksa kondisi langsung dan ikuti arahan petugas.</small>
              </div>
              <button type="button" className="plain-icon" aria-label="Tutup peringatan" onClick={() => setActiveAlert(null)}><X size={17} /></button>
            </section>
          )}

          <section className="map-section panel" id="peta">
            <div className="section-heading map-heading">
              <div className="heading-copy">
                <div className="title-line">
                  <span className="section-icon map-title-icon"><Map size={17} /></span>
                  <h2>Peta pantauan</h2>
                  <span className="live-tag">AREA PANTAUAN</span>
                </div>
                <p>Pantau koridor Bandung Kiwari hingga Katapang</p>
              </div>
              <div className="map-controls">
                <div className="region-select-wrap">
                  <button
                    type="button"
                    className="control-button region-select"
                    aria-expanded={isRegionOpen}
                    onClick={() => setIsRegionOpen((open) => !open)}
                  >
                    <MapPin size={15} />
                    {selectedRegion}
                    <ChevronDown size={15} />
                  </button>
                  {isRegionOpen && (
                    <div className="region-menu">
                      {regions.map((region) => (
                        <button
                          key={region}
                          type="button"
                          className={region === selectedRegion ? 'selected' : ''}
                          onClick={() => {
                            setSelectedRegion(region)
                            setIsRegionOpen(false)
                          }}
                        >
                          {region}
                          {region === selectedRegion && <Check size={15} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="map-control-divider" />
                <button type="button" className="control-button filters-button" onClick={() => notifyComingSoon('Filter lanjutan')}>
                  <SlidersHorizontal size={15} />
                  <span>Filter</span>
                </button>
              </div>
            </div>

            <div className="map-filter-row" aria-label="Filter kategori laporan">
              <span className="filter-label">Tampilkan</span>
              {categories.map(({ id, label, icon: Icon, tone }) => (
                <button
                  type="button"
                  key={id}
                  className={`category-filter ${selectedCategories.includes(id) ? 'is-selected' : ''}`}
                  aria-pressed={selectedCategories.includes(id)}
                  onClick={() => toggleCategory(id)}
                >
                  <Icon size={14} className={`tone-${tone}-text`} />
                  {label}
                  {selectedCategories.includes(id) && <span className="filter-check"><Check size={10} /></span>}
                </button>
              ))}
            </div>

            <IncidentMap reports={reports.filter((report) => selectedCategories.includes(report.category))} />
            <div className="map-footer">
              <span><span className="map-source-dot" /> Basemap © OpenStreetMap contributors</span>
              <span className="map-data-note"><ShieldCheck size={14} /> Titik hanya muncul dari laporan masyarakat</span>
            </div>
          </section>

          <section className="lower-grid">
            <div className="panel recent-panel" id="laporan-terbaru">
              <div className="section-heading compact-heading">
                <div className="heading-copy">
                  <div className="title-line">
                    <span className="section-icon recent-title-icon"><Activity size={17} /></span>
                    <h2>Laporan terbaru</h2>
                  </div>
                  <p>Laporan masyarakat di area pemantauan</p>
                </div>
                <button type="button" className="text-button" onClick={() => notifyComingSoon('Riwayat laporan')}>
                  Lihat riwayat <ArrowRight size={15} />
                </button>
              </div>
              {reports.length === 0 ? (
                <div className="reports-empty">
                  <span className="reports-empty-icon"><MapPin size={19} /></span>
                  <div>
                    <strong>Belum ada laporan</strong>
                    <p>Laporan warga langsung ditampilkan tanpa proses pemeriksaan admin.</p>
                  </div>
                </div>
              ) : (
                <div className="reports-list">
                  {reports.slice(0, 5).map((report) => (
                    <article className="report-item" key={report.id}>
                      <span className={`report-item-icon tone-${categories.find(({ id }) => id === report.category)?.tone || 'orange'}`}><MapPin size={16} /></span>
                      <div className="report-item-copy">
                        <div className="report-item-title">
                          <strong>{getReportLabel(report.category)}</strong>
                          <span>{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(report.createdAt))}</span>
                        </div>
                        <p>{report.address} · {report.description}</p>
                        <span className="community-report-label">Laporan warga · tidak diperiksa admin</span>
                      </div>
                      <a className="report-road-link" href={getNearbyRoadSearch(report)} target="_blank" rel="noreferrer" aria-label={`Cari jalan sekitar ${report.address} di Google Maps`}><ExternalLink size={15} /></a>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="panel region-panel">
              <div className="section-heading compact-heading">
                <div className="heading-copy">
                  <div className="title-line">
                    <span className="section-icon region-title-icon"><Activity size={17} /></span>
                    <h2>Kondisi wilayah</h2>
                  </div>
                  <p>Status laporan terkini</p>
                </div>
                <button type="button" className="plain-icon help-button" aria-label="Tentang status wilayah" onClick={() => notifyComingSoon('Informasi status wilayah')}>
                  <CircleHelp size={17} />
                </button>
              </div>
              <div className="region-status">
                <div className="status-orb"><Activity size={19} /></div>
                <div>
                  <strong>{reports.length ? `${reports.length} laporan ${supabase ? 'bersama' : 'lokal'}` : 'Menunggu laporan'}</strong>
                  <p>{reports.length ? 'Laporan warga tampil langsung tanpa proses pemeriksaan admin.' : 'Kondisi wilayah ditampilkan setelah ada laporan.'}</p>
                </div>
              </div>
              <div className="report-trust-note">
                <ShieldCheck size={14} />
                <span>Informasi berasal dari warga dan tidak diperiksa admin.</span>
              </div>
            </div>
          </section>

          <section className="weather-notice">
            <span className="weather-icon"><CloudRain size={19} /></span>
            <div>
              <strong>{weather?.current ? `${weather.current.weather_desc} · ${weather.current.t}°C di ${weather.location.kecamatan}` : weatherLoading ? 'Memuat prakiraan BMKG...' : 'Prakiraan cuaca BMKG'}</strong>
              <p>{weatherError ? 'Prakiraan belum tersedia. Coba muat ulang halaman Cuaca.' : 'Data resmi BMKG untuk wilayah pantauan, diperbarui dalam interval prakiraan 3 jam.'}</p>
            </div>
            <button type="button" className="weather-open-link" onClick={() => setActiveSection('cuaca')}>Lihat cuaca</button>
          </section>

          <footer className="page-footer">
            <span>KOPO SIAGA <span className="footer-dot">·</span> Kabupaten Bandung</span>
            <span>Informasi laporan masyarakat bukan pengganti informasi resmi pemerintah.</span>
          </footer>
          </>
          )}
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Navigasi utama">
        <button className={activeSection === 'dashboard' ? 'active' : ''} onClick={() => { setActiveSection('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <Activity size={19} /><span>Beranda</span>
        </button>
        <button className={activeSection === 'peta' ? 'active' : ''} onClick={() => { setActiveSection('peta'); document.getElementById('peta')?.scrollIntoView({ behavior: 'smooth' }) }}>
          <Map size={19} /><span>Peta</span>
        </button>
        <button className={activeSection === 'laporan' ? 'active' : ''} onClick={() => { setActiveSection('laporan'); document.getElementById('laporan-terbaru')?.scrollIntoView({ behavior: 'smooth' }) }}>
          <Activity size={19} /><span>Laporan</span>
        </button>
        <button className="mobile-alert-nav" onClick={() => {
          if (!isNotificationOpen) markReportsAsRead()
          setIsNotificationOpen((open) => !open)
        }}>
          <Bell size={19} /><span>Notifikasi</span>
        </button>
      </nav>

      {isReportOpen && <ReportDialog onClose={() => setIsReportOpen(false)} onSubmit={submitReport} />}

      {toast && (
        <div className="toast-message" role="status">
          <span className="toast-check"><Check size={15} /></span>{toast}
          <button className="plain-icon" aria-label="Tutup pesan" onClick={() => setToast('')}><X size={16} /></button>
        </div>
      )}
    </div>
  )
}

export default App
