import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function notifyApplied(job) {
  await resend.emails.send({
    from: process.env.NOTIFY_FROM_EMAIL, // e.g. 'jobs@yourdomain.com' — must be a verified Resend sender
    to: process.env.NOTIFY_TO_EMAIL,
    subject: `Applied: ${job.title} at ${job.company}`,
    text: `Applied for ${job.title} at ${job.company}.\n\nSource: ${job.source}\nJob link: ${job.apply_url}\n\nReply STOP to this address (or flip system_state to 'paused' in Supabase) to pause the bot.`,
  });
}

export async function notifyDailySummary({ submitted, failed, skippedManualAts }) {
  await resend.emails.send({
    from: process.env.NOTIFY_FROM_EMAIL,
    to: process.env.NOTIFY_TO_EMAIL,
    subject: `Job bot — daily summary: ${submitted.length} applied`,
    text: [
      `Applied (${submitted.length}):`,
      ...submitted.map((j) => `- ${j.title} @ ${j.company}`),
      '',
      `Needs manual apply — non-standard form (${skippedManualAts.length}):`,
      ...skippedManualAts.map((j) => `- ${j.title} @ ${j.company} — ${j.apply_url}`),
      '',
      `Failed (${failed.length}):`,
      ...failed.map((j) => `- ${j.title} @ ${j.company} — ${j.reason}`),
    ].join('\n'),
  });
}
