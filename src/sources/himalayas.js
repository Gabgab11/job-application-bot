// Himalayas gives structured `locationRestrictions` per job, so eligibility
// here is a real field check, not a text guess.

const QUERIES = ['customer support', 'telesales', 'collections specialist', 'customer retention'];

export async function fetchHimalayasJobs() {
  const results = [];
  for (const q of QUERIES) {
    const url = `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&limit=25`;
    const res = await fetch(url, { headers: { 'User-Agent': 'personal-job-bot/1.0' } });
    if (!res.ok) continue;
    const data = await res.json();
    for (const j of data.jobs || []) {
      results.push({
        source: 'himalayas',
        source_job_id: j.guid || j.applicationLink,
        title: j.title,
        company: j.companyName,
        description: (j.description || j.excerpt || '').replace(/<[^>]+>/g, ' ').slice(0, 6000),
        apply_url: j.applicationLink,
        location_restrictions: j.locationRestrictions || [],
        // Himalayas gives us this directly - no guessing needed.
        worldwide: !j.locationRestrictions || j.locationRestrictions.length === 0,
        category: (j.categories || [])[0] || null,
      });
    }
  }
  // de-dupe within this batch
  const seen = new Set();
  return results.filter((j) => {
    if (seen.has(j.source_job_id)) return false;
    seen.add(j.source_job_id);
    return true;
  });
}
