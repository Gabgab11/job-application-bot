import { submitGreenhouse } from './submit-greenhouse.js';

export function detectAtsType(applyUrl = '') {
  if (/boards\.greenhouse\.io|job-boards\.greenhouse\.io|greenhouse\.io\/embed/.test(applyUrl)) {
    return 'greenhouse';
  }
  if (/jobs\.lever\.co/.test(applyUrl)) return 'lever';
  if (/jobs\.ashbyhq\.com/.test(applyUrl)) return 'ashby';
  return 'other';
}

/**
 * Returns { status: 'submitted' | 'skipped_manual_ats' | 'failed', reason?: string }
 *
 * Only Greenhouse is auto-submitted end-to-end right now — its form structure
 * is standardized enough to fill reliably. Lever, Ashby, and everything else
 * ("other" — a company's own custom career page) get routed to
 * skipped_manual_ats rather than risk a broken/garbage submission going out
 * unattended. Widening auto-submit coverage is the next build stage.
 */
export async function submitApplication(job, tailored) {
  const ats = detectAtsType(job.apply_url);
  if (ats === 'greenhouse') {
    return submitGreenhouse(job, tailored);
  }
  return { status: 'skipped_manual_ats', reason: `ats_not_yet_supported:${ats}` };
}
