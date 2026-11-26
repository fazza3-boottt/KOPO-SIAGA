import { useEffect, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import {
  Crosshair,
  LocateFixed,
  LoaderCircle,
  MapPin,
  Navigation,
  Search,
  X,
} from 'lucide-react'

const initialCenter = [-7.005, 107.56]
const searchBounds = '107.45,-6.91,107.72,-7.12'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIconRetina,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

function RecenterMap({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 0.8 })
  }, [center, map, zoom])
  return null
}

function LocationControl() {
  const map = useMap()
  const [loading, setLoading] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [error, setError] = useState('')

  const locate = () => {
    if (!navigator.geolocation) {
      setError('Browser ini tidak mendukung lokasi GPS.')
      return
    }
    setLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = [coords.latitude, coords.longitude]
        setUserLocation(point)
        map.flyTo(point, 15, { duration: 0.8 })
        setLoading(false)
      },
      (locationError) => {
        setLoading(false)
        if (locationError.code === locationError.PERMISSION_DENIED) {
          setError('Izin lokasi ditolak. Aktifkan akses lokasi di pengaturan browser.')
        } else if (locationError.code === locationError.TIMEOUT) {
          setError('Lokasi belum ditemukan. Coba lagi di area dengan sinyal GPS yang baik.')
        } else {
          setError('Lokasi tidak dapat diakses saat ini.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <>
      <div className="map-floating-controls">
        <button type="button" className="map-float-button" aria-label="Tampilkan lokasi saya" title="Tampilkan lokasi saya" onClick={locate}>
          {loading ? <LoaderCircle className="spin" size={18} /> : <LocateFixed size={18} />}
        </button>
        <button type="button" className="map-float-button" aria-label="Kembali ke area pantauan" title="Kembali ke area pantauan" onClick={() => map.flyTo(initialCenter, 12, { duration: 0.8 })}>
          <Crosshair size={17} />
        </button>
        <button type="button" className="map-float-button zoom-button" aria-label="Perbesar peta" title="Perbesar peta" onClick={() => map.zoomIn()}>
          +
        </button>
        <button type="button" className="map-float-button zoom-button" aria-label="Perkecil peta" title="Perkecil peta" onClick={() => map.zoomOut()}>
          −
        </button>
      </div>
      {userLocation && (
        <Marker position={userLocation}>
          <Popup>Lokasi Anda saat ini</Popup>
        </Marker>
      )}
      {userLocation && <CircleMarker center={userLocation} radius={14} pathOptions={{ color: '#2379ee', fillColor: '#2379ee', fillOpacity: 0.17, weight: 1 }} />}
      {error && (
        <div className="map-error" role="alert">
          <span>{error}</span><button aria-label="Tutup pesan" onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}
    </>
  )
}

function IncidentMap({ reports = [] }) {
  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState('idle')
  const [searchError, setSearchError] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [mapTarget, setMapTarget] = useState(null)

  const searchPlace = async (event) => {
    event.preventDefault()
    const term = query.trim()
    if (!term) {
      setSearchError('Masukkan nama jalan atau wilayah yang ingin dicari.')
      return
    }
    setSearchState('loading')
    setSearchError('')
    setSearchResults([])
    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        q: term,
        viewbox: searchBounds,
        bounded: '1',
        limit: '5',
        'accept-language': 'id',
      })
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
      if (!response.ok) throw new Error('Layanan pencarian lokasi sedang tidak tersedia.')
      const results = await response.json()
      if (results.length === 0) {
        setSearchError('Lokasi tidak ditemukan di area pantauan. Coba nama jalan atau wilayah lain.')
        setSearchState('empty')
        return
      }
      setSearchResults(results)
      setSearchState('results')
    } catch (error) {
      setSearchError(error.message || 'Pencarian gagal. Periksa koneksi internet Anda.')
      setSearchState('error')
    }
  }

  const chooseResult = (result) => {
    setMapTarget({ center: [Number(result.lat), Number(result.lon)], zoom: 16 })
    setQuery(result.name || result.display_name.split(',')[0])
    setSearchResults([])
    setSearchState('idle')
  }

  return (
    <div className="map-frame">
      <MapContainer
        center={initialCenter}
        zoom={12}
        minZoom={10}
        maxZoom={19}
        scrollWheelZoom
        zoomControl={false}
        className="leaflet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mapTarget && <RecenterMap center={mapTarget.center} zoom={mapTarget.zoom} />}
        <LocationControl />
        {reports.filter((report) => Number.isFinite(report.lat) && Number.isFinite(report.lng)).map((report) => {
          const color = report.category === 'banjir' ? '#2585db'
            : report.category === 'macet' ? '#d98739'
            : report.category === 'rusak' ? '#c59a24'
            : '#d46060'
          return (
            <CircleMarker
              key={report.id}
              center={[report.lat, report.lng]}
              radius={10}
              pathOptions={{ color: '#fff', fillColor: color, fillOpacity: 0.95, weight: 3 }}
            >
              <Popup>
                <strong>{report.category}</strong>
                <br />
                {report.address}
                <br />
                <small>Laporan warga · tidak diperiksa admin · {report.description}</small>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
      <form className="map-search" onSubmit={searchPlace} role="search">
        <Search size={17} />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            if (searchState !== 'loading') setSearchState('idle')
            setSearchError('')
          }}
          placeholder="Cari jalan atau wilayah..."
          aria-label="Cari jalan atau wilayah"
          aria-describedby={searchError ? 'map-search-message' : undefined}
        />
        {query && <button className="clear-search" type="button" aria-label="Hapus pencarian" onClick={() => { setQuery(''); setSearchError(''); setSearchResults([]); setSearchState('idle') }}><X size={15} /></button>}
        <button className="search-submit" type="submit" disabled={searchState === 'loading'} aria-label="Cari lokasi">
          {searchState === 'loading' ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}
        </button>
      </form>

      {searchState === 'results' && (
        <div className="search-results">
          <div className="search-results-heading">Hasil pencarian <button className="plain-icon" aria-label="Tutup hasil" onClick={() => setSearchResults([])}><X size={15} /></button></div>
          {searchResults.map((result) => (
            <button type="button" className="search-result" key={result.place_id} onClick={() => chooseResult(result)}>
              <MapPin size={16} />
              <span><strong>{result.name || result.display_name.split(',')[0]}</strong><small>{result.display_name}</small></span>
            </button>
          ))}
        </div>
      )}
      {searchError && <div id="map-search-message" className="search-error" role="status">{searchError}</div>}
      {reports.length === 0 || !reports.some((report) => Number.isFinite(report.lat) && Number.isFinite(report.lng)) ? (
        <div className="map-empty-callout">
          <span className="map-empty-icon"><Navigation size={17} /></span>
          <span>
            <strong>{reports.length ? 'Laporan belum memiliki titik peta' : 'Belum ada laporan'}</strong>
            <small>{reports.length ? 'Alamat laporan masih terlihat di daftar laporan.' : 'Laporan yang dikirim dari browser ini akan ditampilkan di peta.'}</small>
          </span>
        </div>
      ) : null}
      <div className="map-area-label"><span className="area-label-pip" /> Kopo – Katapang <span>·</span> Kab. Bandung</div>
    </div>
  )
}

export default IncidentMap
