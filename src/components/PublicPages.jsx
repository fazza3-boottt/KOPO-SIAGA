import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  Cloud,
  CloudRain,
  CloudSun,
  ExternalLink,
  MapPin,
  Moon,
  Navigation,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  Video,
} from 'lucide-react'
import { isBackendConfigured, supabase } from '../lib/supabase.js'

const regions = ['Semua wilayah', 'Bandung Kiwari', 'Cigondewah', 'TKI', 'Kopo', 'Margahayu', 'Katapang']

function PublicPages({
  section,
  reports,
  showToast,
  notificationPermission,
  onEnableNotifications,
  weather,
  weatherLoading,
  weatherError,
  weatherLocations,
  selectedWeatherLocation,
  onWeatherLocationChange,
  onWeatherRetry,
}) {
  const [notifications, setNotifications] = useState([])
  const [cameras, setCameras] = useState([])
  const [camerasLoading, setCamerasLoading] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [cameraRetry, setCameraRetry] = useState(0)
  const [watchedRegion, setWatchedRegion] = useState(() => window.localStorage.getItem('kopo-siaga-region') || 'Semua wilayah')
  const [startPoint, setStartPoint] = useState('')
  const [destination, setDestination] = useState('')

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (active && !error) setNotifications(data || [])
      })
    return () => { active = false }
  }, [section])

  useEffect(() => {
    if (section !== 'cctv') return undefined

    if (!supabase) {
      setCameras([])
      setCamerasLoading(false)
      setCameraError('')
      return undefined
    }

    let active = true
    setCamerasLoading(true)
    setCameraError('')

    const loadCameras = async () => {
      try {
        const { data, error } = await supabase
          .from('cctv_cameras')
          .select('id, name, area, official_url, embed_url, status')
          .eq('is_public', true)
          .order('area')

        if (error) throw error
        if (active) setCameras(data || [])
      } catch (error) {
        if (active) setCameraError(error.message || 'Terjadi kesalahan saat memuat CCTV.')
      } finally {
        if (active) setCamerasLoading(false)
      }
    }

    loadCameras()
    return () => { active = false }
  }, [section, cameraRetry])

  const saveRegion = (region) => {
    setWatchedRegion(region)
    window.localStorage.setItem('kopo-siaga-region', region)
    showToast(`Wilayah pantauan diatur ke ${region}.`)
  }

  if (section === 'notifikasi') {
    const reportCategoryLabels = {
      banjir: 'Banjir',
      macet: 'Kemacetan',
      rusak: 'Jalan rusak',
      tutup: 'Jalan ditutup',
      kecelakaan: 'Kecelakaan',
    }

    return (
      <section className="public-page">
        <div className="public-heading"><span className="section-icon"><Bell size={17} /></span><div><h1>Pusat Notifikasi</h1><p>Pengumuman dan laporan kondisi jalan terbaru dari warga.</p></div></div>
        <div className="preference-strip"><div><strong>Wilayah dipantau</strong><small>Pengumuman dapat dipilih berdasarkan cakupan wilayah.</small></div><select value={watchedRegion} onChange={(event) => saveRegion(event.target.value)}>{regions.map((region) => <option key={region}>{region}</option>)}</select></div>
        {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
          <div className="preference-strip">
            <div><strong>Terima peringatan di perangkat</strong><small>Izinkan notifikasi browser saat KOPO SIAGA terbuka.</small></div>
            <button type="button" className="enable-notifications-button" onClick={onEnableNotifications}>Aktifkan notifikasi</button>
          </div>
        )}
        <div className="notification-section-heading">
          <strong>Laporan warga terbaru</strong>
          <small>{isBackendConfigured ? 'Diperbarui langsung untuk pengunjung yang sedang membuka situs.' : 'Saat ini hanya tersedia di browser ini. Supabase diperlukan untuk berbagi lintas perangkat.'}</small>
        </div>
        {reports.length === 0 ? (
          <div className="public-empty"><AlertTriangle size={22} /><strong>Belum ada laporan warga</strong><p>{isBackendConfigured ? 'Laporan baru akan muncul otomatis di sini.' : 'Hubungkan Supabase agar laporan dapat diterima pengunjung dari perangkat lain.'}</p></div>
        ) : (
          <div className="public-list">
            {reports.slice(0, 20).map((report) => (
              <article className="public-notification urgency-important" key={report.id}>
                <div className="public-notification-icon"><AlertTriangle size={17} /></div>
                <div>
                  <span>Laporan warga · {reportCategoryLabels[report.category] || 'Gangguan jalan'} · {formatReportDate(report.createdAt)}</span>
                  <strong>{report.address}</strong>
                  <p>{report.description}</p>
                  <small>Informasi warga; tidak diperiksa admin.</small>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="notification-section-heading">
          <strong>Pengumuman KOPO SIAGA</strong>
        </div>
        {notifications.length === 0 ? (
          <div className="public-empty"><Bell size={22} /><strong>Belum ada pengumuman</strong><p>{isBackendConfigured ? 'Pengumuman akan muncul di sini saat tersedia.' : 'Hubungkan Supabase untuk menerima pengumuman lintas perangkat.'}</p></div>
        ) : (
          <div className="public-list">
            {notifications.map((item) => (
              <article className={`public-notification urgency-${item.urgency || 'normal'}`} key={item.id}>
                <div className="public-notification-icon"><Bell size={17} /></div>
                <div><span>{item.category || 'Pengumuman'} · {item.area || 'Seluruh wilayah'}</span><strong>{item.title}</strong><p>{item.message}</p></div>
              </article>
            ))}
          </div>
        )}
      </section>
    )
  }

  if (section === 'cuaca') {
    const description = weather?.current?.weather_desc || ''
    const isRaining = /hujan|gerimis|petir|badai/i.test(description)
    const isClear = /cerah/i.test(description)
    const isNight = getWeatherTime(weather?.current?.local_datetime) === 'night'
    const forecastIcon = isRaining ? CloudRain : isClear ? (isNight ? Moon : Sun) : Cloud
    const WeatherIcon = forecastIcon
    const temperature = weather?.current?.t
    const locationName = weather?.location?.kecamatan || 'Kabupaten Bandung'
    const hourlyForecasts = weather?.upcoming || []

    return (
      <section className="public-page">
        <div className="public-heading"><span className="section-icon"><CloudSun size={17} /></span><div><h1>Cuaca Wilayah Pantauan</h1><p>Prakiraan tiga harian resmi BMKG, diperbarui setiap 3 jam.</p></div></div>
        <div className="weather-toolbar">
          <label htmlFor="weather-location">Wilayah pantauan</label>
          <select id="weather-location" value={selectedWeatherLocation} onChange={(event) => onWeatherLocationChange(event.target.value)}>
            {weatherLocations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}
          </select>
        </div>
        {weatherLoading ? (
          <div className="public-empty"><CloudSun size={24} /><strong>Mengambil prakiraan cuaca BMKG...</strong></div>
        ) : weatherError ? (
          <div className="public-empty weather-error" role="alert"><CloudSun size={24} /><strong>Prakiraan cuaca belum dapat dimuat</strong><p>{weatherError}</p><button type="button" className="camera-retry" onClick={onWeatherRetry}>Coba lagi</button></div>
        ) : weather ? (
          <>
            <div className={`weather-hero ${isRaining ? 'weather-hero-rain' : isClear ? 'weather-hero-clear' : 'weather-hero-cloudy'}`} data-time={getWeatherTime(weather.current.local_datetime)}>
              <div className="weather-atmosphere" aria-hidden="true">
                {getWeatherTime(weather.current.local_datetime) === 'night'
                  ? Array.from({ length: 18 }, (_, index) => <i className={`weather-star star-${index % 6}`} key={index} />)
                  : <span className="weather-sun-glow" />}
                {isRaining && Array.from({ length: 24 }, (_, index) => <i className={`rain-drop drop-${index % 8}`} key={index} />)}
              </div>
              <div className="weather-hero-copy">
                <span className="weather-eyebrow">PRAKIRAAN · {locationName.toUpperCase()}</span>
                <div className="weather-temperature"><strong>{temperature ?? '—'}°</strong><WeatherIcon size={38} strokeWidth={1.6} /></div>
                <h2>{description || 'Cuaca belum tersedia'}</h2>
                <p>{formatForecastDate(weather.current.local_datetime)} · data per 3 jam</p>
              </div>
              <div className="weather-city" aria-hidden="true">
                <div className="bandung-skyline">
                  <span /><span /><span /><span /><span />
                  <svg className="gedung-sate" viewBox="0 0 52 96" fill="none">
                    <path d="M25 5h2v13h-2zM22 18h8v4h-8zM15 27h22l-4 5H19l-4-5Zm-4 8h30v5H11zm4 8h22v6h-4v37h-5V49h-4v36h-5V49h-4v31h-5V49h-4V43Z" fill="currentColor" />
                    <path d="M8 84h36v5H8z" fill="currentColor" />
                  </svg>
                </div>
                <div className="city-road"><span className="weather-car"><i /></span></div>
              </div>
              <div className="weather-hero-note"><span>{weather.location?.desa}, {weather.location?.kecamatan}</span><span>{temperature >= 30 ? 'Terasa hangat' : temperature <= 22 ? 'Udara sejuk' : 'Nyaman untuk beraktivitas'}</span></div>
            </div>
            <div className="weather-metrics">
              <article><span>SUHU</span><strong>{temperature ?? '—'}°C</strong></article>
              <article><span>KELEMBAPAN</span><strong>{weather.current.hu ?? '—'}%</strong></article>
              <article><span>ANGIN</span><strong>{weather.current.ws ?? '—'} <small>km/jam</small></strong></article>
              <article><span>HUJAN</span><strong>{weather.current.tp ?? '—'} <small>mm</small></strong></article>
            </div>
            <div className="forecast-panel">
              <div className="forecast-heading"><div><strong>Perkiraan berikutnya</strong><small>Perubahan cuaca di wilayah pantauan</small></div><span>Setiap 3 jam</span></div>
              <div className="forecast-timeline">
                {hourlyForecasts.map((forecast) => {
                  const Icon = /hujan|gerimis|petir|badai/i.test(forecast.weather_desc) ? CloudRain : /cerah/i.test(forecast.weather_desc) ? Sun : Cloud
                  return (
                    <article key={forecast.datetime}>
                      <time>{formatForecastTime(forecast.local_datetime)}</time>
                      <Icon size={19} />
                      <strong>{forecast.t}°</strong>
                      <span>{forecast.weather_desc}</span>
                    </article>
                  )
                })}
              </div>
            </div>
          </>
        ) : null}
        <p className="bmkg-attribution">Sumber data: <a href="https://data.bmkg.go.id/prakiraan-cuaca/" target="_blank" rel="noreferrer">BMKG · Prakiraan Cuaca</a>{weather?.issuedAt && <> · Analisis {formatIssuedAt(weather.issuedAt)}</>}</p>
      </section>
    )
  }

  if (section === 'cctv') {
    return (
      <section className="public-page">
        <div className="public-heading"><span className="section-icon"><Video size={17} /></span><div><h1>CCTV Lalu Lintas</h1><p>Tayangan kamera publik yang dikelola dari sumber resmi.</p></div></div>
        {camerasLoading ? (
          <div className="public-empty"><Video size={22} /><strong>Memuat kamera CCTV...</strong></div>
        ) : cameraError ? (
          <div className="public-empty camera-error" role="alert"><Video size={22} /><strong>CCTV gagal dimuat</strong><p>{cameraError}</p><button type="button" className="camera-retry" onClick={() => setCameraRetry((current) => current + 1)}>Coba lagi</button></div>
        ) : cameras.length ? (
          <div className="camera-grid">
            {cameras.map((camera) => {
              const embedUrl = getHttpsUrl(camera.embed_url)
              const officialUrl = getHttpsUrl(camera.official_url)
              return (
                <article className="camera-card" key={camera.id}>
                  <div className="camera-frame">
                    {embedUrl ? (
                      <iframe
                        src={embedUrl}
                        title={`CCTV ${camera.name} - ${camera.area}`}
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    ) : (
                      <div className="camera-unavailable"><Video size={23} /><span>Tayangan belum tersedia</span></div>
                    )}
                  </div>
                  <div className="camera-details">
                    <span><strong>{camera.name}</strong><small>{camera.area}</small></span>
                    {officialUrl && <a className="official-link" href={officialUrl} target="_blank" rel="noreferrer">Sumber resmi <ExternalLink size={14} /></a>}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="public-empty"><Video size={22} /><strong>{isBackendConfigured ? 'Belum ada kamera publik' : 'Koneksi CCTV belum diatur'}</strong><p>{isBackendConfigured ? 'Belum ada kamera aktif yang dipublikasikan pada tabel cctv_cameras.' : 'Hubungkan Supabase dan tambahkan URL CCTV resmi untuk menampilkan tayangan.'}</p></div>
        )}
        <a className="official-link" href="https://dishub.bandungkab.go.id/" target="_blank" rel="noreferrer">Cek portal resmi Dishub Bandung <ExternalLink size={14} /></a>
      </section>
    )
  }

  if (section === 'navigasi') {
    const publicReports = reports
    return (
      <section className="public-page">
        <div className="public-heading"><span className="section-icon"><Navigation size={17} /></span><div><h1>Navigasi & Rute Alternatif</h1><p>Lihat laporan warga untuk membantu merencanakan perjalanan.</p></div></div>
        <div className="route-form">
          <label>Lokasi awal<div><MapPin size={15} /><input value={startPoint} onChange={(event) => setStartPoint(event.target.value)} placeholder="Contoh: Cigondewah" /></div></label>
          <label>Tujuan<div><MapPin size={15} /><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Contoh: Katapang" /></div></label>
          <button type="button" onClick={() => {
            if (!startPoint.trim() || !destination.trim()) return showToast('Isi lokasi awal dan tujuan.')
            const query = encodeURIComponent(`${startPoint.trim()} ke ${destination.trim()}, Kabupaten Bandung`)
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank', 'noopener,noreferrer')
          }}><Search size={15} /> Cari rute</button>
        </div>
        <div className="route-advisory"><ShieldCheck size={18} /><div><strong>Informasi dari warga</strong><p>{publicReports.length ? `${publicReports.length} laporan warga tersedia. Informasi tidak diperiksa admin; pastikan kondisi langsung sebelum berangkat.` : 'Belum ada laporan warga. Tidak adanya laporan bukan jaminan jalan aman.'}</p></div></div>
        {publicReports.slice(0, 5).map((item) => <div className="route-report" key={item.id}><AlertIcon /><span><strong>{item.category} · {item.address}</strong><small>Laporan warga · tidak diperiksa admin</small></span></div>)}
      </section>
    )
  }

  if (section === 'profil') {
    return (
      <section className="public-page">
        <div className="public-heading"><span className="section-icon"><UserRound size={17} /></span><div><h1>Profil Pengguna</h1><p>Atur preferensi wilayah dan informasi akun.</p></div></div>
        <div className="profile-card"><span className="profile-large">P</span><div><strong>Pengguna Publik</strong><small>Akses tanpa login</small></div></div>
        <div className="preference-strip"><div><strong>Preferensi wilayah notifikasi</strong><small>Digunakan sebagai filter tampilan dan preferensi lokal.</small></div><select value={watchedRegion} onChange={(event) => saveRegion(event.target.value)}>{regions.map((region) => <option key={region}>{region}</option>)}</select></div>
      </section>
    )
  }

  return null
}

function getHttpsUrl(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function formatReportDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'waktu tidak diketahui'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(date)
}

function getWeatherTime(value) {
  const hour = Number(value?.slice(11, 13))
  if (!Number.isFinite(hour)) return 'day'
  if (hour < 5 || hour >= 19) return 'night'
  if (hour < 8) return 'morning'
  if (hour < 16) return 'day'
  return 'evening'
}

function formatForecastDate(value) {
  const date = new Date(`${value.replace(' ', 'T')}+07:00`)
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(date)
}

function formatForecastTime(value) {
  const date = new Date(`${value.replace(' ', 'T')}+07:00`)
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(date)
}

function formatIssuedAt(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date)
}

function AlertIcon() {
  return <span className="route-alert-icon"><ShieldCheck size={15} /></span>
}

export default PublicPages
