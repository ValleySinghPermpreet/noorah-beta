import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null

export async function saveSubmission(data) {
  if (!supabase) {
    console.warn('Supabase not configured — saving to localStorage')
    const list = JSON.parse(localStorage.getItem('noorah_submissions') || '[]')
    list.push(data)
    localStorage.setItem('noorah_submissions', JSON.stringify(list))
    return true
  }
  const { error } = await supabase.from('submissions').insert([{
    name: data.name,
    email: data.email,
    total_score: data.total,
    severity: data.severity,
    prescription: data.prescription,
    gateway_why: data.gatewayWhy,
    gateway_tag: data.gatewayTag,
    dimensions: data.dimensions,
    lembke: data.lembke,
    context: data.context,
    plan: data.plan,
  }])
  if (error) {
    console.error('Supabase save error:', error)
    // Fallback to localStorage
    const list = JSON.parse(localStorage.getItem('noorah_submissions') || '[]')
    list.push(data)
    localStorage.setItem('noorah_submissions', JSON.stringify(list))
  }
  return !error
}

export async function loadSubmissions() {
  if (!supabase) {
    return JSON.parse(localStorage.getItem('noorah_submissions') || '[]')
  }
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Supabase load error:', error)
    return JSON.parse(localStorage.getItem('noorah_submissions') || '[]')
  }
  // Map DB fields back to app format
  return data.map(row => ({
    id: row.id,
    timestamp: row.created_at,
    name: row.name,
    email: row.email,
    total: row.total_score,
    severity: row.severity,
    prescription: row.prescription,
    gatewayWhy: row.gateway_why,
    gatewayTag: row.gateway_tag,
    dimensions: row.dimensions,
    lembke: row.lembke,
    context: row.context,
    plan: row.plan,
  }))
}
