import { XMLParser } from 'fast-xml-parser';

const FEEDS = [
  'https://weworkremotely.com/categories/remote-customer-support-jobs.rss',
  'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss',
];

export async function fetchWwrJobs() {
  const parser = new XMLParser();
  const results = [];
  for (const feedUrl of FEEDS) {
    const res = await fetch(feedUrl, { headers: { 'User-Agent': 'personal-job-bot/1.0' } });
    if (!res.ok) continue;
    const xml = await res.text();
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item || [];
    const arr = Array.isArray(items) ? items : [items];
    for (const item of arr) {
      if (!item?.link) continue;
      results.push({
        source: 'wwr',
        source_job_id: item.guid?.['#text'] || item.guid || item.link,
        title: item.title || '',
        company: (item.title || '').split(':')[0] || null, // WWR titles are usually "Company: Role"
        description: (item.description || '').replace(/<[^>]+>/g, ' ').slice(0, 6000),
        apply_url: item.link,
        location_restrictions: null,
        worldwide: null,
        category: item.category || null,
      });
    }
  }
  return results;
}
