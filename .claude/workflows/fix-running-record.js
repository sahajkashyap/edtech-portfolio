export const meta = {
  name: 'fix-running-record',
  description: 'Fix the confirmed findings in Word by Word, in small batches, each proven before the next',
  whenToUse: 'After verify-everything on running-record-tool has confirmed a batch of findings.',
  phases: [
    { title: 'Fix',   detail: 'one agent per batch of related findings' },
    { title: 'Prove', detail: 'a different agent re-drives each batch' },
    { title: 'Report', detail: 'what is fixed, what is still open' },
  ],
}

const REPO   = '/Users/sahajkashyap/Documents/GitHub/edtech-portfolio'
const TOOL   = REPO + '/running-record-tool'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const TESTS  = TOOL + '/tests'

const cfg    = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const FILE   = cfg.findingsFile
const BATCHES = cfg.batches || []
const MODEL  = (cfg.model === 'inherit') ? undefined : (cfg.model || 'opus')

const FIXED = {
  type: 'object',
  required: ['batch', 'fixed', 'skipped', 'checksNow'],
  properties: {
    batch: { type: 'string' },
    checksNow: { type: 'integer', description: 'total checks in run-tests.js after your work' },
    fixed: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'how', 'howToSee'],
        properties: {
          id: { type: 'string' },
          how: { type: 'string' },
          howToSee: { type: 'string', description: 'exact steps to see it working now' },
        },
      },
    },
    skipped: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'why'],
        properties: { id: { type: 'string' }, why: { type: 'string' } },
      },
    },
  },
}

const PROOF = {
  type: 'object',
  required: ['batch', 'allHold', 'results', 'newProblems'],
  properties: {
    batch: { type: 'string' },
    allHold: { type: 'boolean' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'holds', 'evidence'],
        properties: {
          id: { type: 'string' },
          holds: { type: 'boolean' },
          evidence: { type: 'string' },
        },
      },
    },
    newProblems: { type: 'array', items: { type: 'string' } },
  },
}

const HARNESS = `
DRIVE A REAL BROWSER for every claim. Never reason about the code and predict.
  - puppeteer-core: ${TESTS}/node_modules
  - Chrome: '${CHROME}'
  - Serve ${TOOL} over a local http server on 127.0.0.1. NOT file:// — localStorage is blocked there.
  - The harness to copy is the top of ${TESTS}/run-tests.js.
  - Favicon 404s are noise; the URL is in m.location().url, not the message text.
`

const RULES = `
THIS TOOL IS "WORD BY WORD", a running record tool, and it is Sahaj's flagship. Rules:

1. It is ONE self-contained HTML file. No build step, no dependencies, no network calls.
   It must keep working by opening the file.
2. It does NOT get a sample student. It has a worked example page instead. Do not add one.
3. Only INITIALS and a date identify a child, never a name. "Stays on this laptop" is a promise.
4. Match the file's voice exactly. Read the comments around your change first. Where a fix is not
   obvious, leave a short comment saying WHAT WAS WRONG, so a later reader cannot undo it by
   accident. That convention is why this file is maintainable — keep it.
5. NEVER change what the tool DECIDES without saying so loudly in your report: a word list gets no
   reading level; self-corrections, repetitions and appeals are not errors; the band is read off
   the ROUNDED accuracy. These are pedagogical choices, not implementation details.
6. THE SCREEN, THE PRINTED RECORD AND THE SPREADSHEET MUST AGREE. Three surfaces re-derive the
   same arithmetic. If you change a number anywhere, change it everywhere, and prove all three.
7. Do not touch tests/node_modules.
`

log('Fixing ' + BATCHES.length + ' batches of findings in Word by Word')

phase('Fix')
const results = await pipeline(
  BATCHES,

  b => agent(`You are fixing part of ${TOOL}/index.html — the "Word by Word" running record tool.

Read ${FILE}. It has one key, "running-record-tool", whose "findings" array holds every confirmed
defect. YOUR BATCH IS "${b.name}". Work ONLY on the findings whose id is in this list:
${JSON.stringify(b.ids)}

Each finding carries a summary, the exact steps that reproduce it, and what was observed versus
expected. Every one was already reproduced in a real browser by two independent agents, so treat
them as real — but if you drive the steps and it does NOT reproduce, say so under "skipped" with
your evidence rather than changing code that is fine.

${RULES}

${HARNESS}

DO THIS:
1. Reproduce each finding in your batch first, so you know what you are fixing.
2. Fix it. Small, surgical changes that match the surrounding code.
3. Add a check for EACH fix to ${TESTS}/run-tests.js, in that file's existing style: inside a
   group(), named for what a PERSON would notice, with the one-line comment about what was once
   wrong. Put your checks in a new group near the end; do not reorganise the file.
4. Run the whole suite until it is green:
     cd ${TESTS} && node run-tests.js
   It must ALL pass — not just your new checks. If an existing check now fails, you have broken
   something: fix your change, do not weaken the check.
5. Then run: cd ${TESTS} && node run-tests.js --coverage
   Report the coverage figure. If your changes added lines nothing executes, add checks for them.

Other agents are fixing OTHER batches in this same file at the same time. Keep your edits tight
and local to the lines your findings name, so the edits do not collide.

Report checksNow as the total number of checks the suite reports after your work.`,
    { label: 'fix:' + b.name, phase: 'Fix', schema: FIXED, model: MODEL }),

  (fixReport, b) => {
    if (!fixReport) return null
    return agent(`Independently check a set of fixes in ${TOOL}/index.html. You did not make them.

The agent that did claims:
${JSON.stringify(fixReport.fixed, null, 1)}

${HARNESS}

For EACH claim, follow its "howToSee" steps yourself and record what you actually observe. Set
holds=false for anything you cannot reproduce — a claim you could not verify is not a fix.

Then look for damage, which matters as much:
  - Load cold: any JavaScript or console errors?
  - Run the full suite (cd ${TESTS} && node run-tests.js). Does it ALL pass? Report the count.
  - Look for checks that pass while testing the WRONG MOMENT — e.g. reading a printed value only
    after a reload, so the real type-then-print path is never exercised. Name any you find.
  - THE THREE SURFACES: pick a marked-up record and confirm the screen, the printed record and the
    exported spreadsheet report the same words read, errors, accuracy, error rate and rate. This
    file has had three separate defects from those three re-deriving the same arithmetic.
  - Confirm the pedagogy is untouched: a word list still gets NO reading level on any surface;
    self-corrections, repetitions and appeals are still not counted as errors.
  - Scan the rendered page and every export for undefined, NaN, Infinity, [object Object], null.

Report the batch name "${b.name}". Do NOT edit any file. You are the check, not the author.`,
      { label: 'prove:' + b.name, phase: 'Prove', schema: PROOF, model: MODEL })
      .then(proof => ({ batch: b.name, fixReport, proof }))
  }
)

const done = results.filter(Boolean)
const failed = done.filter(d => d.proof && !d.proof.allHold)
log(done.length + ' batches done, ' + failed.length + ' with something that did not hold')

phase('Report')
const report = await agent(`Summarise for Sahaj Kashyap — a teacher of 14 years, not a software
engineer. Plain language, define any technical term in one line the first time.

This is his flagship tool, "Word by Word". A verification run confirmed 39 defects; he fixed 6
himself and these agents fixed the rest in batches, each batch then checked by a different agent:

${JSON.stringify(done.map(d => ({
  batch: d.batch,
  fixed: d.fixReport && d.fixReport.fixed && d.fixReport.fixed.map(f => f.id),
  skipped: d.fixReport && d.fixReport.skipped,
  allHeld: d.proof && d.proof.allHold,
  didNotHold: d.proof && (d.proof.results || []).filter(x => !x.holds),
  newProblems: d.proof && d.proof.newProblems,
})), null, 1)}

Write:
1. WHAT IS FIXED — grouped by what a teacher would notice, worst first. Not a list of ids.
2. STILL OPEN — anything that did not hold, or was deliberately skipped, and why. Be blunt.
3. IS IT SAFE TO PUT IN FRONT OF A RECRUITER OR A TEACHER TODAY — your honest yes or no, and what
   would change your mind.
4. WHAT SAHAJ SHOULD CHECK HIMSELF — two or three things, because his judgement about what a
   teacher needs beats any agent's.

Direct, no padding, no cheerleading.`,
  { label: 'summary', phase: 'Report', model: MODEL })

return {
  batches: done.length,
  allHeld: done.every(d => d.proof && d.proof.allHold),
  perBatch: done.map(d => ({
    batch: d.batch,
    fixed: d.fixReport ? d.fixReport.fixed.length : 0,
    skipped: d.fixReport ? d.fixReport.skipped.length : 0,
    held: d.proof ? d.proof.allHold : null,
    didNotHold: d.proof ? (d.proof.results || []).filter(x => !x.holds).map(x => x.id) : [],
    newProblems: d.proof ? d.proof.newProblems : [],
  })),
  report,
}
