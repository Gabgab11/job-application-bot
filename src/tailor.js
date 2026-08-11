import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Used only for ambiguous cases the regex/structured filter couldn't resolve.
export async function semanticEligibilityCheck(job) {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `A candidate lives in Egypt and needs a fully remote job that does NOT require US work authorization, US citizenship, or US residency, and does NOT require a security clearance.

Job title: ${job.title}
Company: ${job.company}
Description (may be truncated):
${job.description.slice(0, 3000)}

Does this specific posting allow someone based in Egypt (not the US, not Canada) to be hired and work remotely from there, with no US work-authorization requirement? Answer with ONLY a JSON object, no other text:
{"eligible": true|false, "reason": "one short sentence"}`,
      },
    ],
  });
  const text = msg.content.find((b) => b.type === 'text')?.text || '{}';
  try {
    return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
  } catch {
    return { eligible: false, reason: 'could not parse eligibility check - treated as not eligible' };
  }
}

export async function tailorApplication(job, profile) {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `Write a tailored application for this candidate applying to this job. Use ONLY facts from the candidate profile below - never invent experience, skills, or claims not present in it.

CANDIDATE PROFILE:
${JSON.stringify(profile, null, 2)}

JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description.slice(0, 3000)}

Return ONLY a JSON object, no other text:
{
  "resume_summary": "2-3 sentence professional summary tailored to this specific role, using only real facts from the profile",
  "cover_note": "short 3-4 sentence application note/cover letter for this specific job, professional tone, using only real facts from the profile"
}`,
      },
    ],
  });
  const text = msg.content.find((b) => b.type === 'text')?.text || '{}';
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
    if (!parsed.resume_summary) throw new Error('missing resume_summary');
    return parsed;
  } catch {
    // Don't let a parse failure leave this application stuck in limbo -
    // fall back to the profile's own summary so it still gets queued.
    return {
      resume_summary: profile.summary,
      cover_note: null,
      parse_failed: true,
    };
  }
}
