import chromium from '@sparticuz/chromium';
import playwright from 'playwright-core';
import profile from '../data/profile.json' with { type: 'json' };
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESUME_PATH = path.join(__dirname, '../data/resume.pdf');

// Field-label substrings we treat as a hard stop: if a required question on
// the live form matches one of these, we do NOT guess an answer — we abort
// and route the job to manual review instead of risking a false statement
// on a real application.
const HARD_STOP_QUESTION_PATTERNS = [
  /authoriz\w* to work/i,
  /require sponsorship/i,
  /u\.?s\.? citizen/i,
  /green card/i,
  /security clearance/i,
];

export async function submitGreenhouse(job, tailored) {
  let browser;
  try {
    browser = await playwright.chromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.goto(job.apply_url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Greenhouse embeds the application form in an iframe on some boards,
    // inline on others — check both.
    const form = (await page.$('#application_form')) ? page : await getIframeContext(page);
    if (!form) return { status: 'failed', reason: 'greenhouse_form_not_found' };

    // Abort if any required question text matches a hard-stop pattern —
    // these were supposed to be filtered upstream, but ATS-level custom
    // questions don't always appear in the job description text.
    const bodyText = await form.textContent('body').catch(() => '');
    if (HARD_STOP_QUESTION_PATTERNS.some((re) => re.test(bodyText ?? ''))) {
      return { status: 'skipped_manual_ats', reason: 'hard_stop_question_on_live_form' };
    }

    await fillIfPresent(form, '#first_name', profile.name.split(' ')[0]);
    await fillIfPresent(form, '#last_name', profile.name.split(' ').slice(1).join(' '));
    await fillIfPresent(form, '#email', profile.email);
    await fillIfPresent(form, '#phone', profile.phone);

    const resumeInput = await form.$('input[type="file"][name*="resume" i]');
    if (resumeInput) await resumeInput.setInputFiles(RESUME_PATH);

    const coverInput = await form.$('textarea[name*="cover" i], #cover_letter_text');
    if (coverInput && tailored?.note) await coverInput.fill(tailored.note);

    // Any remaining required text/textarea fields we haven't explicitly
    // mapped (custom free-text questions) — leave untouched rather than
    // guess; Greenhouse blocks submit on missing-required fields, which is
    // exactly the safety net we want here.
    const submitBtn = await form.$('#submit_app, button[type="submit"]');
    if (!submitBtn) return { status: 'failed', reason: 'submit_button_not_found' };

    const stillMissingRequired = await hasUnfilledRequiredFields(form);
    if (stillMissingRequired) {
      return { status: 'skipped_manual_ats', reason: 'unmapped_required_custom_question' };
    }

    await submitBtn.click();
    await page.waitForTimeout(2000);

    return { status: 'submitted' };
  } catch (err) {
    return { status: 'failed', reason: String(err?.message ?? err) };
  } finally {
    if (browser) await browser.close();
  }
}

async function getIframeContext(page) {
  const frame = page.frames().find((f) => /greenhouse/.test(f.url()));
  return frame ?? null;
}

async function fillIfPresent(ctx, selector, value) {
  const el = await ctx.$(selector);
  if (el && value) await el.fill(String(value));
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
