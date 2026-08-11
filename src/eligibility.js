// Eligibility + role-fit filter. Uses structured Himalayas location data
// when available, falls back to text-pattern screening for sources that
// don't expose structured restrictions (RemoteOK, We Work Remotely).

const EXCLUDE_PATTERNS = [
  /must be (?:a )?(?:us|u\.s\.) citizen/i,
  /(?:us|u\.s\.) citizens? only/i,
  /must be authoriz(?:ed|ation) to work in the (?:us|u\.s\.|united states)/i,
  /work authorization.{0,20}(?:us|u\.s\.|united states)/i,
  /authoriz(?:ed|ation) to work in the (?:us|u\.s\.|united states)(?! or)/i,
  /must reside in the (?:us|u\.s\.|united states)/i,
  /must be (?:located|based) in the (?:us|u\.s\.|united states)/i,
  /(?:us|u\.s\.)[- ]based candidates? only/i,
  /no (?:visa )?sponsorship/i,
  /sponsorship is not (?:available|provided)/i,
  /will not sponsor/i,
  /does not offer (?:visa )?sponsorship/i,
  /must be physically located in the (?:us|united states)/i,
  /within the (?:us|united states) only/i,
  /open only to (?:us|u\.s\.|united states) residents/i,
  /candidates must be located in the (?:us|u\.s\.|united states)/i,
  /eligible to work in the (?:us|u\.s\.|united states) without sponsorship/i,
  /must be (?:a )?permanent resident/i,
  /must be legally authorized to work in canada/i,
  /security clearance required/i,
  /green card/i,
  /\brequires? us residency\b/i,
  /\bus timezone required\b/i,
];

const INCLUDE_SIGNALS = [
  /work from anywhere/i,
  /anywhere in the world/i,
  /worldwide/i,
  /globally remote/i,
  /global remote/i,
  /remote[- ]global/i,
  /open to (?:international|global) candidates/i,
  /any location/i,
  /hire(?:s)? (?:internationally|globally)/i,
  /fully distributed/i,
];

const ROLE_KEYWORDS = [
  'customer support', 'customer service', 'customer success', 'customer retention',
  'telesales', 'tele-sales', 'collections', 'collections specialist', 'collector',
  'credit control', 'account executive - collections', 'client success',
  'support specialist', 'support agent', 'call center', 'contact center',
  'inside sales', 'sales representative', 'sales agent', 'help desk',
];

const REMOTE_KEYWORDS = ['remote', 'work from home', 'wfh', 'anywhere', 'distributed'];

function looksRemote(text) {
  const hay = text.toLowerCase();
  return REMOTE_KEYWORDS.some((k) => hay.includes(k));
}

// Returns { eligible: true|false|null, reason } - null means "ambiguous, ask Claude"
export function checkEligibility(job) {
  // Himalayas gives us a real field - trust it first. Conservative rule:
  // any non-empty restriction list excludes the job, since we can't be sure
  // Egypt (or wherever the candidate is) falls inside a partial list.
  if (job.worldwide === true) return { eligible: true, reason: 'himalayas: no location restriction' };
  if (Array.isArray(job.location_restrictions) && job.location_restrictions.length > 0) {
    return {
      eligible: false,
      reason: `himalayas: restricted to ${job.location_restrictions.join(', ')}`,
    };
  }

  const hay = `${job.title} ${job.description}`;

  // Text-fallback sources (RemoteOK, WWR) don't give structured "is this
  // actually remote" data either - if it doesn't even mention remote/WFH,
  // don't waste a semantic check on it.
  if (job.worldwide === null && !looksRemote(hay)) {
    return { eligible: false, reason: 'text: does not appear to be a remote listing' };
  }

  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(hay)) return { eligible: false, reason: `excluded: ${pattern}` };
  }
  if (INCLUDE_SIGNALS.some((p) => p.test(hay))) {
    return { eligible: true, reason: 'text: explicit worldwide/global language' };
  }
  return { eligible: null, reason: 'ambiguous - needs semantic check' };
}

export function matchesRole(job) {
  const hay = `${job.title} ${job.description}`.toLowerCase();
  return ROLE_KEYWORDS.some((k) => hay.includes(k));
}
