export const weatherLocations = [
  { id: '32.04.09.2001', label: 'Kopo · Margahayu', area: 'Margahayu' },
  { id: '32.04.10.2001', label: 'Margaasih', area: 'Margaasih' },
  { id: '32.04.11.2001', label: 'Katapang', area: 'Katapang' },
  { id: '32.04.08.2001', label: 'Bojongsoang', area: 'Bojongsoang' },
]

export async function fetchWeatherForecast(locationId, signal) {
  const response = await fetch(`/api/bmkg/prakiraan-cuaca?adm4=${encodeURIComponent(locationId)}`, { signal })
  if (!response.ok) {
    throw new Error(`Layanan BMKG tidak merespons (HTTP ${response.status}).`)
  }

  const result = await response.json()
  const location = result.data?.[0]?.lokasi
  const forecasts = (result.data || [])
    .flatMap((area) => area.cuaca || [])
    .flatMap((period) => period || [])
    .filter((forecast) => forecast.local_datetime && forecast.weather_desc)
    .sort((first, second) => parseLocalDate(first.local_datetime) - parseLocalDate(second.local_datetime))

  if (!location || forecasts.length === 0) {
    throw new Error('Data prakiraan BMKG untuk wilayah ini belum tersedia.')
  }

  const now = Date.now()
  const nextForecastIndex = forecasts.findIndex((forecast) => parseLocalDate(forecast.local_datetime).getTime() >= now - 60 * 60 * 1000)
  const currentIndex = nextForecastIndex === -1 ? forecasts.length - 1 : nextForecastIndex

  return {
    location,
    current: forecasts[currentIndex],
    upcoming: forecasts.slice(currentIndex, currentIndex + 6),
    issuedAt: forecasts[currentIndex].analysis_date || '',
  }
}

function parseLocalDate(value) {
  return new Date(`${value.replace(' ', 'T')}+07:00`)
}
