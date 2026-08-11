const KEYWORDS = /customer support|customer service|telesales|collections|customer retention|customer success/i;

export async function fetchRemoteOkJobs() {
  const res = await fetch('https://remoteok.com/api', {
    headers: { 'User-Agent': 'personal-job-bot/1.0' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  // first element is always RemoteOK's API legal notice, not a job
  const jobs = data.filter((j) => j.id && j.position);

  return jobs
    .filter((j) => KEYWORDS.test(j.position) || KEYWORDS.test((j.tags || []).join(' ')))
    .map((j) => ({
      source: 'remoteok',
      source_job_id: String(j.id),
      title: j.position,
      company: j.company,
      description: (j.description || '').replace(/<[^>]+>/g, ' ').slice(0, 6000),
      apply_url: j.apply_url || j.url,
      location_restrictions: null, // RemoteOK doesn't give structured data - text screen only
      worldwide: null, // unknown, resolved by the eligibility text screen
      category: (j.tags || [])[0] || null,
    }));
}
