import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { fetchHimalayasJobs } from './sources/himalayas.js';
import { fetchRemoteOkJobs } from './sources/remoteok.js';
import { fetchWwrJobs } from './sources/wwr.js';
import { checkEligibility, matchesRole } from './eligibility.js';
import { semanticEligibilityCheck, tailorApplication } from './tailor.js';
import { detectAtsType, submitGreenhouse } from './submit.js';
import { notifyApplied, notifyDailySummary } from './notify.js';
import {
  getSystemStatus,
  jobExists,
  insertJob,
  insertApplication,
  getPendingApplications,
  updateApplication,
  countAppliedToday,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const profile = JSON.parse(readFileSync(path.join(__dirname, 'profile.json'), 'utf8'));

const DAILY_APPLY_TARGET = Number(process.env.DAILY_APPLY_TARGET || 6);
const MAX_SEMANTIC_CHECKS_PER_RUN = 15; // cost/time control on the Claude calls

async function discoverAndFilter() {
  const [himalayas, remoteok, wwr] = await Promise.all([
    fetchHimalayasJobs().catch(() => []),
    fetchRemoteOkJobs().catch(() => []),
    fetchWwrJobs().catch(() => []),
  ]);
  const allJobs = [...himalayas, ...remoteok, ...wwr];
  console.log(`Discovered ${allJobs.length} raw listings across sources`);

  let semanticChecksUsed = 0;
  let queued = 0;

  for (const job of allJobs) {
    if (await jobExists(job.source, job.source_job_id)) continue;
    if (!matchesRole(job)) continue;

    let { eligible, reason } = checkEligibility(job);

    if (eligible === null && semanticChecksUsed < MAX_SEMANTIC_CHECKS_PER_RUN) {
      semanticChecksUsed++;
      const result = await semanticEligibilityCheck(job).catch(() => ({ eligible: false, reason: 'check failed' }));
      eligible = result.eligible;
      reason = result.reason;
    } else if (eligible === null) {
      eligible = false;
      reason = 'ambiguous, semantic-check budget exhausted for this run';
    }

    const savedJob = await insertJob({
      source: job.source,
      source_job_id: job.source_job_id,
      title: job.title,
      company: job.company,
      description: job.description,
      apply_url: job.apply_url,
      location_restrictions: job.location_restrictions,
      worldwide: !!job.worldwide,
      requires_us_auth: eligible === false,
      category: job.category,
      ats_type: detectAtsType(job.apply_url),
    });
    if (!savedJob || !eligible) continue;

    const tailored = await tailorApplication(job, profile).catch(() => null);
    await insertApplication({
      job_id: savedJob.id,
      status: tailored ? 'tailored' : 'pending',
      tailored_resume_summary: tailored?.resume_summary || null,
      tailored_note: tailored?.cover_note || null,
    });
    queued++;
  }
  console.log(`Queued ${queued} new eligible, role-matched applications`);
}

async function submitQueued() {
  const alreadyApplied = await countAppliedToday();
  const remaining = Math.max(0, DAILY_APPLY_TARGET - alreadyApplied);
  if (remaining === 0) {
    console.log('Daily apply target already reached');
    return { applied: 0, skipped: 0, failed: 0 };
  }

  const pending = await getPendingApplications(remaining);
  let applied = 0, skipped = 0, failed = 0;

  for (const app of pending) {
    const job = app.jobs;
    if (job.ats_type !== 'greenhouse') {
      await updateApplication(app.id, { status: 'skipped_manual_ats' });
      skipped++;
      continue;
    }

    const tailored = { cover_note: app.tailored_note };
    const result = await submitGreenhouse(job, profile, tailored);

    if (result.status === 'submitted') {
      await updateApplication(app.id, { status: 'submitted', applied_at: new Date().toISOString() });
      await notifyApplied(job).catch((e) => console.error('notify failed', e));
      applied++;
    } else if (result.status === 'blocked_auth_question') {
      await updateApplication(app.id, { status: 'skipped_manual_ats', fail_reason: result.reason });
      skipped++;
    } else {
      await updateApplication(app.id, { status: 'failed', fail_reason: result.reason });
      failed++;
    }
  }
  return { applied, skipped, failed };
}

async function main() {
  const status = await getSystemStatus();
  if (status !== 'active') {
    console.log(`System status is "${status}" - exiting without doing anything.`);
    return;
  }

  await discoverAndFilter();
  const { applied, skipped, failed } = await submitQueued();
  await notifyDailySummary({ appliedCount: applied, skippedCount: skipped, failedCount: failed });
  console.log(`Run complete. Applied: ${applied}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Fatal error in run:', err);
  process.exit(1);
});
