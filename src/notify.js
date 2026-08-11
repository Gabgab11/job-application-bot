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

export async function notifyDailySummary({ appliedCount, skippedCount, failedCount }) {
  if (appliedCount === 0 && skippedCount === 0 && failedCount === 0) return; // nothing happened, stay quiet
  await resend.emails.send({
    from: process.env.NOTIFY_FROM_EMAIL,
    to: process.env.NOTIFY_TO_EMAIL,
    subject: `Job bot run: ${appliedCount} applied`,
    text: `Today's run:\n- Applied: ${appliedCount}\n- Skipped (unsupported ATS, needs manual apply): ${skippedCount}\n- Failed: ${failedCount}`,
  });
}
