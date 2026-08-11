import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESUME_PATH = path.join(__dirname, 'resume.pdf');

const AUTH_QUESTION_PATTERNS = [
  /authoriz(?:ed|ation) to work in the (?:us|u\.s\.|united states)/i,
  /require.{0,20}sponsorship/i,
  /now or in the future require sponsorship/i,
  /legally (?:authorized|eligible) to work/i,
];

export function detectAtsType(url) {
  if (!url) return 'other';
  if (url.includes('boards.greenhouse.io') || url.includes('job-boards.greenhouse.io')) return 'greenhouse';
  if (url.includes('jobs.lever.co')) return 'lever';
  if (url.includes('jobs.ashbyhq.com')) return 'ashby';
  return 'other';
}

/**
 * Submits a Greenhouse-hosted application. Returns:
 *   { status: 'submitted' } | { status: 'blocked_auth_question', reason } | { status: 'failed', reason }
 * Never guesses on an authorization question - aborts instead.
 */
export async function submitGreenhouse(job, profile, tailored) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(job.apply_url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Safety net: if this specific posting's rendered page asks an authorization
    // question we didn't catch during filtering, abort rather than answer it.
    const bodyText = await page.textContent('body').catch(() => '');
    if (AUTH_QUESTION_PATTERNS.some((p) => p.test(bodyText || ''))) {
      return { status: 'blocked_auth_question', reason: 'form asks a US work-authorization question' };
    }

    const [firstName, ...rest] = profile.name.split(' ');
    const lastName = rest.join(' ');

    const fill = async (selectors, value) => {
      for (const sel of selectors) {
        const el = page.locator(sel).first();
        if (await el.count()) {
          await el.fill(value).catch(() => {});
          return true;
        }
      }
      return false;
    };

    await fill(['#first_name', 'input[name="first_name"]'], firstName);
    await fill(['#last_name', 'input[name="last_name"]'], lastName);
    await fill(['#email', 'input[name="email"]'], profile.email);
    await fill(['#phone', 'input[name="phone"]'], profile.phone || '');

    const resumeInput = page.locator('input[type="file"]').first();
    if (await resumeInput.count()) {
      await resumeInput.setInputFiles(RESUME_PATH);
      await page.waitForTimeout(1500); // let Greenhouse's uploader process it
    }

    const coverField = page.locator('textarea[name*="cover"], textarea#cover_letter_text').first();
    if (await coverField.count() && tailored?.cover_note) {
      await coverField.fill(tailored.cover_note);
    }

    // Re-check for an authorization question rendered only after fields are filled
    // (some Greenhouse forms reveal custom questions progressively).
    const bodyTextAfter = await page.textContent('body').catch(() => '');
    if (AUTH_QUESTION_PATTERNS.some((p) => p.test(bodyTextAfter || ''))) {
      return { status: 'blocked_auth_question', reason: 'auth question appeared after form fill' };
    }

    const submitBtn = page.locator('button#submit_app, button[type="submit"]').first();
    if (!(await submitBtn.count())) {
      return { status: 'failed', reason: 'could not find submit button' };
    }
    await submitBtn.click();
    await page.waitForTimeout(3000);

    const confirmed = await page
      .locator('text=/thank you|application (received|submitted|complete)/i')
      .first()
      .count();
    if (!confirmed) {
      return { status: 'failed', reason: 'no confirmation text found after submit - unverified' };
    }
    return { status: 'submitted' };
  } catch (err) {
    return { status: 'failed', reason: String(err).slice(0, 300) };
  } finally {
    await browser.close();
  }
}
