// Jobicy gives a jobGeo field (e.g. "USA", "Anywhere", "Europe") - another
// real structured eligibility signal, same idea as Himalayas' locationRestrictions.

const WORLDWIDE_GEO_VALUES = ['anywhere', 'worldwide', 'global', 'any'];
const QUERIES = ['customer support', 'telesales', 'collections', 'customer retention'];

export async function fetchJobicyJobs() {
  const results = [];
  for (const q of QUERIES) {
    const url = `https://jobicy.com/api/v2/remote-jobs?count=30&tag=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'personal-job-bot/1.0' } });
    if (!res.ok) continue;
    const data = await res.json();
    for (const j of data.jobs || []) {
      const geo = (j.jobGeo || '').toLowerCase();
      const worldwide = WORLDWIDE_GEO_VALUES.some((w) => geo.includes(w));
      results.push({
        source: 'jobicy',
        source_job_id: String(j.id),
        title: j.jobTitle,
        company: j.companyName,
        description: (j.jobDescription || j.jobExcerpt || '').replace(/<[^>]+>/g, ' ').slice(0, 6000),
        apply_url: j.url,
        location_restrictions: worldwide ? [] : (j.jobGeo ? [j.jobGeo] : []),
        worldwide,
        category: j.jobIndustry || null,
      });
    }
  }
  const seen = new Set();
  return results.filter((j) => {
    if (seen.has(j.source_job_id)) return false;
    seen.add(j.source_job_id);
    return true;
  });
}

