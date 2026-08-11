const US_CA_ONLY_TERMS = ['united states', 'usa', 'u.s.', 'us only', 'canada'];

// Phrases that mean "you must already have the right to work in the US/Canada" —
// disqualifying regardless of what locationRestrictions says, since these are
// often buried in free text rather than structured data.
const AUTH_DISQUALIFIERS = [
  /must be authoriz\w* to work in the (u\.?s\.?|united states)/i,
  /work authorization.{0,20}(u\.?s\.?|united states)/i,
  /must be (a )?u\.?s\.? citizen/i,
  /must be (a )?permanent resident/i,
  /green card holder/i,
  /no (visa )?sponsorship/i,
  /sponsorship is not (available|provided)/i,
  /must (reside|be located|be based) in the (u\.?s\.?|united states)/i,
  /open only to (u\.?s\.?|united states) residents/i,
  /candidates must be located in the (u\.?s\.?|united states)/i,
  /eligible to work in the (u\.?s\.?|united states) without sponsorship/i,
  /must be legally authorized to work in canada/i,
];

const ROLE_KEYWORDS = [
  'customer support', 'customer service', 'customer success', 'customer retention',
  'telesales', 'tele-sales', 'inside sales', 'sales representative', 'sales agent',
  'collections', 'collector', 'credit control', 'account executive', 'call center',
  'contact center', 'help desk', 'support agent', 'support specialist',
];

const REMOTE_KEYWORDS = ['remote', 'work from home', 'wfh', 'anywhere', 'distributed'];

function textOf(job) {
  return `${job.title ?? ''} ${job.description ?? ''}`.toLowerCase();
}

function isRoleRelevant(job) {
  const t = textOf(job);
  return ROLE_KEYWORDS.some((k) => t.includes(k));
}

function looksRemote(job) {
  const t = textOf(job);
  return REMOTE_KEYWORDS.some((k) => t.includes(k));
}

function restrictedToUsOrCanadaOnly(job) {
  const restrictions = (job.location_restrictions ?? []).map((c) => c.toLowerCase());
  if (restrictions.length === 0) return false; // no restriction = worldwide, fine
  const onlyUsCa = restrictions.every((c) => US_CA_ONLY_TERMS.some((term) => c.includes(term)));
  return onlyUsCa;
}

function textFlagsUsAuthRequirement(job) {
  const t = `${job.title ?? ''} ${job.description ?? ''}`;
  return AUTH_DISQUALIFIERS.some((re) => re.test(t));
}

/**
 * Returns { eligible: boolean, reason?: string, requires_us_auth: boolean }
 */
export function evaluateEligibility(job) {
  const requiresUsAuth = textFlagsUsAuthRequirement(job);

  if (requiresUsAuth) {
    return { eligible: false, reason: 'requires_us_work_authorization', requires_us_auth: true };
  }
  if (restrictedToUsOrCanadaOnly(job)) {
    return { eligible: false, reason: 'location_restricted_to_us_ca', requires_us_auth: true };
  }
  if (!looksRemote(job)) {
    return { eligible: false, reason: 'not_clearly_remote', requires_us_auth: false };
  }
  if (!isRoleRelevant(job)) {
    return { eligible: false, reason: 'not_target_role', requires_us_auth: false };
  }
  return { eligible: true, requires_us_auth: false };
}
