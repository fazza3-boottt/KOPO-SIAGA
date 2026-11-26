import { useEffect, useState } from 'react'
import { LoaderCircle, MapPin, Send, X } from 'lucide-react'

const reportCategories = [
  { id: 'banjir', label: 'Banjir / genangan' },
  { id: 'macet', label: 'Kemacetan' },
  { id: 'rusak', label: 'Jalan rusak' },
  { id: 'tutup', label: 'Jalan ditutup' },
  { id: 'kecelakaan', label: 'Kecelakaan / gangguan lalu lintas' },
]

const searchBounds = '107.45,-6.91,107.72,-7.12'

async function findCoordinates(address) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: `${address}, Kabupaten Bandung`,
    viewbox: searchBounds,
    bounded: '1',
    limit: '1',
    'accept-language': 'id',
  })
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
  if (!response.ok) throw new Error('Layanan pencarian lokasi tidak tersedia.')
  const results = await response.json()
  if (!results.length) return null
  return { lat: Number(results[0].lat), lng: Number(results[0].lon) }
}

function ReportDialog({ onClose, onSubmit }) {
  const [category, setCategory] = useState('banjir')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState('sedang')
  const [incidentAt, setIncidentAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [photoName, setPhotoName] = useState('')
  const [gps, setGps] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isSubmitting, onClose])

  const useGps = () => {
    if (!navigator.geolocation) {
      setSubmitError('Browser ini tidak mendukung lokasi GPS.')
      return
    }
    setGpsLoading(true)
    setSubmitError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGps({ lat: coords.latitude, lng: coords.longitude })
        setGpsLoading(false)
      },
      () => {
        setSubmitError('Lokasi GPS tidak dapat diakses. Periksa izin lokasi browser.')
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const submitReport = async (event) => {
    event.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError('')

    let coordinates = null
    let locationNote = ''
    try {
      if (gps) coordinates = gps
      else coordinates = await findCoordinates(address.trim())
      if (!coordinates) locationNote = 'Alamat tidak ditemukan di peta; laporan tetap tersimpan tanpa pin.'
    } catch {
      locationNote = 'Layanan pencarian peta tidak tersedia; laporan tetap tersimpan tanpa pin.'
    }

    try {
      await onSubmit({
        id: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        category,
        title: title.trim(),
        address: address.trim(),
        description: description.trim(),
        createdAt: new Date().toISOString(),
        incidentAt: new Date(incidentAt).toISOString(),
        severity,
        photoName,
        lat: coordinates?.lat ?? null,
        lng: coordinates?.lng ?? null,
        locationNote,
      })
    } catch (error) {
      setSubmitError(error.message || 'Laporan gagal dikirim. Silakan coba kembali.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSubmitting) onClose()
    }}>
      <section className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
        <div className="dialog-heading">
          <div>
            <span className="dialog-eyebrow"><MapPin size={14} /> LAPORAN MASYARAKAT</span>
            <h2 id="report-dialog-title">Laporkan kondisi jalan</h2>
            <p>Bantu pengguna lain lebih siap dengan informasi lokasi dan kondisi.</p>
          </div>
          <button type="button" className="plain-icon" aria-label="Tutup formulir" onClick={onClose} disabled={isSubmitting}><X size={19} /></button>
        </div>

        <form className="report-form" onSubmit={submitReport}>
          <label>
            Judul laporan
            <input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ringkasan singkat kejadian" />
          </label>
          <label>
            Jenis kejadian
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {reportCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <div className="report-form-row">
            <label>Tingkat keparahan<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="rendah">Rendah</option><option value="sedang">Sedang</option><option value="tinggi">Tinggi</option></select></label>
            <label>Waktu kejadian<input type="datetime-local" required value={incidentAt} onChange={(event) => setIncidentAt(event.target.value)} /></label>
          </div>
          <label>
            Alamat atau nama jalan
            <input
              autoFocus
              required
              maxLength={160}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Contoh: Jalan Kopo, Margahayu"
            />
          </label>
          <div className="gps-photo-row">
            <button type="button" className="gps-button" onClick={useGps} disabled={gpsLoading}>{gpsLoading ? 'Mencari lokasi...' : gps ? 'GPS sudah dipilih' : 'Gunakan lokasi GPS'}</button>
            <label className="photo-input">Foto pendukung<input type="file" accept="image/*" capture="environment" onChange={(event) => setPhotoName(event.target.files?.[0]?.name || '')} /></label>
          </div>
          {photoName && <small className="field-hint">Foto dipilih: {photoName}</small>}
          <label>
            Keterangan
            <textarea
              required
              minLength={8}
              maxLength={500}
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Jelaskan kondisi yang Anda lihat, misalnya kedalaman genangan atau panjang antrean."
            />
            <span className="field-hint">Jangan sertakan data pribadi atau informasi yang tidak Anda pastikan.</span>
          </label>
          <div className="report-privacy-note">
            Alamat digunakan untuk mencari titik peta melalui OpenStreetMap. Laporan langsung ditampilkan dan tidak diperiksa admin; pastikan kondisi terkini sebelum bepergian. Peringatan suara/getar bergantung pada dukungan perangkat.
          </div>
          {submitError && <p className="admin-error" role="alert">{submitError}</p>}
          <div className="dialog-actions">
            <button type="button" className="dialog-cancel" onClick={onClose} disabled={isSubmitting}>Batal</button>
            <button type="submit" className="report-submit" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="spin" size={16} /> : <Send size={15} />}
              {isSubmitting ? 'Mengirim...' : 'Kirim laporan'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default ReportDialog
