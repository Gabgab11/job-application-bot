import Anthropic from '@anthropic-ai/sdk';
import profile from '../data/profile.json' with { type: 'json' };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function tailorForJob(job) {
  const prompt = `You are helping tailor a job application. Given the candidate profile and the job posting below, produce:
1. A 3-4 sentence resume summary tailored to this specific posting (pull from the candidate's real experience only — never invent employers, titles, dates, or skills not present in the profile).
2. A short application note (60-90 words) suitable for a cover-letter/message field, specific to this company and role.

Candidate profile:
${JSON.stringify(profile, null, 2)}

Job posting:
Title: ${job.title}
Company: ${job.company}
Description: ${(job.description ?? '').slice(0, 4000)}

Respond ONLY with JSON: {"resume_summary": "...", "note": "..."}`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content.find((b) => b.type === 'text')?.text ?? '{}';
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { resume_summary: profile.summary, note: null, parse_failed: true };
  }
}
