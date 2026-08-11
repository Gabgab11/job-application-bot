import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // server-side only, never expose to a client
);

export async function isSystemActive() {
  const { data, error } = await supabase
    .from('system_state')
    .select('status')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data.status === 'active';
}

export async function pauseSystem() {
  const { error } = await supabase
    .from('system_state')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw error;
}

export async function upsertJob(job) {
  const { data, error } = await supabase
    .from('jobs')
    .upsert(job, { onConflict: 'source,source_job_id', ignoreDuplicates: true })
    .select();
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function jobAlreadyQueued(jobId) {
  const { data, error } = await supabase
    .from('applications')
    .select('id')
    .eq('job_id', jobId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function createApplication(jobId) {
  const { data, error } = await supabase
    .from('applications')
    .insert({ job_id: jobId, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateApplication(id, fields) {
  const { error } = await supabase.from('applications').update(fields).eq('id', id);
  if (error) throw error;
}

export { supabase };
