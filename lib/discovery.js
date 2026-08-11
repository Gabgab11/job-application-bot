import { XMLParser } from 'fast-xml-parser';

// Search terms tuned to the target roles: customer support / telesales / collections.
const QUERIES = [
  'customer support',
  'customer service',
  'telesales',
  'collections',
  'customer retention',
  'inside sales',
];

const WWR_FEEDS = [
  'https://weworkremotely.com/categories/remote-customer-support-jobs.rss',
  'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss',
];

const REMOTEOK_TAGS = ['customer-support', 'sales', 'support'];

// --- Himalayas ---------------------------------------------------------
// Docs: https://himalayas.app/docs/remote-jobs-api
// Structured `locationRestrictions` field makes this the most reliable source
// for the "open to candidates outside US/Canada" filter.
export async function fetchHimalayas() {
  const results = [];
  for (const q of QUERIES) {
    const url = `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&sort=recent`;
    const res = await fetch(url, { headers: { 'User-Agent': 'personal-job-bot/0.1' } });
    if (!res.ok) continue;
    const json = await res.json();
    for (const j of json.jobs ?? []) {
      results.push({
        source: 'himalayas',
        source_job_id: j.guid,
        title: j.title,
        company: j.companyName,
        description: j.description,
        apply_url: j.applicationLink,
        location_restrictions: (j.locationRestrictions ?? []).map((c) => c.name),
        worldwide: (j.locationRestrictions ?? []).length === 0,
        category: (j.categories ?? [])[0] ?? null,
      });
    }
  }
  return dedupe(results);
}

// --- RemoteOK ------------------------------------------------------------
// Docs: https://remoteok.com/api (public, no auth). Skews tech-heavy, so
// treat as a secondary source for this role type — keep it in the mix,
// but expect lower yield than Himalayas/WWR for customer-support roles.
export async function fetchRemoteOK() {
  const results = [];
  for (const tag of REMOTEOK_TAGS) {
    const url = `https://remoteok.com/api?tags=${encodeURIComponent(tag)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'personal-job-bot/0.1' } });
    if (!res.ok) continue;
    const json = await res.json();
    // First element is a legend/metadata object on RemoteOK's feed — skip it.
    for (const j of json.slice(1)) {
      if (!j.id) continue;
      results.push({
        source: 'remoteok',
        source_job_id: String(j.id),
        title: j.position,
        company: j.company,
        description: j.description,
        apply_url: j.url ?? j.apply_url,
        location_restrictions: [], // RemoteOK doesn't expose structured restrictions —
        worldwide: null,           // eligibility filter falls back to text screening for this source
        category: (j.tags ?? [])[0] ?? null,
      });
    }
  }
  return dedupe(results);
}

// --- We Work Remotely (RSS) ----------------------------------------------
export async function fetchWWR() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const results = [];
  for (const feedUrl of WWR_FEEDS) {
    const res = await fetch(feedUrl, { headers: { 'User-Agent': 'personal-job-bot/0.1' } });
    if (!res.ok) continue;
    const xml = await res.text();
    const json = parser.parse(xml);
    const items = json?.rss?.channel?.item ?? [];
    for (const it of Array.isArray(items) ? items : [items]) {
      results.push({
        source: 'wwr',
        source_job_id: it.link,
        title: it.title,
        company: it['region'] ?? '', // WWR RSS titles are often "Company: Role" — see normalize step below
        description: it.description,
        apply_url: it.link,
        location_restrictions: [],
        worldwide: null,
        category: null,
      });
    }
  }
  return dedupe(normalizeWwrTitles(results));
}

function normalizeWwrTitles(jobs) {
  // WWR titles commonly arrive as "Company Name: Job Title"
  return jobs.map((j) => {
    const [maybeCompany, ...rest] = String(j.title).split(':');
    if (rest.length) {
      return { ...j, company: maybeCompany.trim(), title: rest.join(':').trim() };
    }
    return j;
  });
}

function dedupe(jobs) {
  const seen = new Set();
  return jobs.filter((j) => {
    const key = `${j.source}:${j.source_job_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function discoverAll() {
  const [himalayas, remoteok, wwr] = await Promise.all([
    fetchHimalayas().catch((e) => { console.error('Himalayas fetch failed', e); return []; }),
    fetchRemoteOK().catch((e) => { console.error('RemoteOK fetch failed', e); return []; }),
    fetchWWR().catch((e) => { console.error('WWR fetch failed', e); return []; }),
  ]);
  return [...himalayas, ...remoteok, ...wwr];
}
