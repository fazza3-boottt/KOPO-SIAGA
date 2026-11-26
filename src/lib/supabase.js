import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isBackendConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const backendConfigurationError = supabaseUrl || supabaseAnonKey
  ? 'Konfigurasi Supabase belum lengkap. Isi URL proyek dan anon key di .env.local.'
  : 'Sinkronisasi lintas perangkat belum aktif. Isi URL proyek dan anon key Supabase di .env.local.'
export const supabase = isBackendConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null

export function mapReport(row) {
  return {
    id: row.id,
    category: row.category,
    address: row.address,
    description: row.description,
    createdAt: row.created_at,
    lat: row.lat,
    lng: row.lng,
    locationNote: row.location_note || '',
    title: row.title || '',
    severity: row.severity || 'sedang',
  }
}
