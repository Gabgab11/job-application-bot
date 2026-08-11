import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function notifyApplied(job) {
  await resend.emails.send({
    from: process.env.NOTIFY_FROM_EMAIL,
    to: process.env.NOTIFY_TO_EMAIL,
    subject: `Applied: ${job.title} at ${job.company}`,
    text: `Just applied on your behalf:\n\n${job.title} at ${job.company}\n${job.apply_url}\n\nSource: ${job.source}`,
  });
}

// jobs: { applied: [], skipped: [], failed: [] } - each entry { title, company, apply_url, reason? }
export async function notifyDailySummary(jobs) {
  const { applied = [], skipped = [], failed = [] } = jobs;
  if (applied.length === 0 && skipped.length === 0 && failed.length === 0) return; // nothing happened, stay quiet

  const lines = [`Applied (${applied.length}):`, ...applied.map((j) => `- ${j.title} @ ${j.company}`)];
  if (skipped.length) {
    lines.push('', `Needs manual apply - non-standard form (${skipped.length}):`);
    lines.push(...skipped.map((j) => `- ${j.title} @ ${j.company} - ${j.apply_url}`));
  }
  if (failed.length) {
    lines.push('', `Failed (${failed.length}):`);
    lines.push(...failed.map((j) => `- ${j.title} @ ${j.company} - ${j.reason || 'unknown error'}`));
  }

  await resend.emails.send({
    from: process.env.NOTIFY_FROM_EMAIL,
    to: process.env.NOTIFY_TO_EMAIL,
    subject: `Job bot run: ${applied.length} applied`,
    text: lines.join('\n'),
  });
}
