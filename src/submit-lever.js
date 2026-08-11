 import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESUME_PATH = path.join(__dirname, 'resume.pdf');

const HARD_STOP_QUESTION_PATTERNS = [
  /authoriz(?:ed|ation) to work in the (?:us|u\.s\.|united states)/i,
  /require.{0,20}sponsorship/i,
  /now or in the future require sponsorship/i,
  /legally (?:authorized|eligible) to work/i,
  /u\.?s\.? citizen/i,
  /green card/i,
  /security clearance/i,
];

async function fillIfPresent(ctx, selector, value) {
  const el = await ctx.$(selector);
  if (el && value) await el.fill(String(value));
  return !!el;
}

async function hasUnfilledRequiredFields(ctx) {
  return ctx.evaluate(() => {
    const required = Array.from(document.querySelectorAll('[required]'));
    return required.some((el) => {
      if (el.type === 'file') return !el.files?.length;
      if (el.tagName === 'SELECT') return !el.value;
      return !el.value || el.value.trim() === '';
    });
  });
}

/**
 * Submits a Lever-hosted application (jobs.lever.co/{company}/{jobId}).
 * Same safety contract as Greenhouse: never guesses on an authorization
 * question, aborts on any unmapped required field rather than risk an
 * incomplete or wrong submission.
 * Returns { status: 'submitted' } | { status: 'blocked_auth_question', reason } | { status: 'failed', reason }
 */
export async function submitLever(job, profile, tailored) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(job.apply_url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Lever's "Apply for this job" button on the posting page leads to a
    // separate /apply page on some boards - follow it if the form isn't here yet.
    if (!(await page.$('form'))) {
      const applyLink = await page.$('a[href*="/apply"]');
      if (applyLink) {
        await applyLink.click();
        await page.waitForLoadState('domcontentloaded').catch(() => {});
      }
    }

    const bodyText = await page.textContent('body').catch(() => '');
    if (HARD_STOP_QUESTION_PATTERNS.some((re) => re.test(bodyText ?? ''))) {
      return { status: 'blocked_auth_question', reason: 'form asks a US work-authorization question' };
    }

    await fillIfPresent(page, 'input[name="name"]', profile.name);
    await fillIfPresent(page, 'input[name="email"]', profile.email);
    await fillIfPresent(page, 'input[name="phone"]', profile.phone);
    await fillIfPresent(page, 'input[name="org"]', profile.headline || '');

    const resumeInput = await page.$('input[name="resume"], input[type="file"]');
    if (resumeInput) {
      await resumeInput.setInputFiles(RESUME_PATH);
      await page.waitForTimeout(1500);
    }

    const coverField = await page.$('textarea[name*="comment" i], textarea[name*="cover" i]');
    if (coverField && tailored?.cover_note) await coverField.fill(tailored.cover_note);

    const bodyTextAfter = await page.textContent('body').catch(() => '');
    if (HARD_STOP_QUESTION_PATTERNS.some((re) => re.test(bodyTextAfter ?? ''))) {
      return { status: 'blocked_auth_question', reason: 'auth question appeared after form fill' };
    }

    const submitBtn = await page.$('button[type="submit"]');
    if (!submitBtn) return { status: 'failed', reason: 'submit_button_not_found' };

    if (await hasUnfilledRequiredFields(page)) {
      return { status: 'blocked_auth_question', reason: 'unmapped_required_custom_question' };
    }

    await submitBtn.click();
    await page.waitForTimeout(3000);

    const confirmed = await page
      .locator('text=/thank you|application (received|submitted|complete)|successfully applied/i')
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

