import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getSystemStatus() {
  const { data, error } = await supabase
    .from('system_state')
    .select('status')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data.status; // 'active' | 'paused'
}

export async function jobExists(source, sourceJobId) {
  const { data } = await supabase
    .from('jobs')
    .select('id')
    .eq('source', source)
    .eq('source_job_id', sourceJobId)
    .maybeSingle();
  return !!data;
}

export async function insertJob(job) {
  const { data, error } = await supabase
    .from('jobs')
    .insert(job)
    .select()
    .single();
  if (error) {
    // unique violation (already discovered) is fine, not a real error
    if (error.code === '23505') return null;
    throw error;
  }
  return data;
}

export async function insertApplication(app) {
  const { data, error } = await supabase
    .from('applications')
    .insert(app)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPendingApplications(limit) {
  const { data, error } = await supabase
    .from('applications')
    .select('*, jobs(*)')
    .eq('status', 'tailored')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function updateApplication(id, fields) {
  const { error } = await supabase.from('applications').update(fields).eq('id', id);
  if (error) throw error;
}

export async function countAppliedToday() {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted')
    .gte('applied_at', startOfDay.toISOString());
  if (error) throw error;
  return count || 0;
}

export default supabase;
