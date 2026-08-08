export const meta = {
  name: 'fix-portfolio',
  description: 'Fix the confirmed findings in each portfolio tool, then prove each fix in a browser',
  whenToUse: 'After a portfolio audit. One agent per tool, each owning its own folder, then an independent agent re-drives it to prove the fix.',
  phases: [
    { title: 'Fix',      detail: 'one agent per tool, each owns one folder' },
    { title: 'Prove',    detail: 'a different agent re-drives it and checks every claim' },
    { title: 'Re-fix',   detail: 'anything that failed proving goes back once' },
    { title: 'Report',   detail: 'what changed, what is still open' },
  ],
}

const REPO    = '/Users/sahajkashyap/Documents/GitHub/edtech-portfolio'
const CHROME  = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const TESTDIR = REPO + '/running-record-tool/tests'
const REFERENCE = REPO + '/running-record-tool/index.html'
const REF_TESTS = TESTDIR + '/run-tests.js'

const cfg   = (typeof args === 'string') ? JSON.parse(args) : (args || {})
// Just the folder names. The findings themselves live in a JSON file on disk
// and each agent reads its OWN section — a workflow script cannot touch the
// filesystem, but the agents it spawns can, and piping 60+ findings through
// the script would cost more than it is worth.
const TOOLS  = (cfg.tools || []).map(t => (typeof t === 'string' ? { tool: t } : t))
const AUDIT  = cfg.auditFile
const MODEL  = (cfg.model === 'inherit') ? undefined : (cfg.model || 'opus')

const FIXED = {
  type: 'object',
  required: ['tool', 'fixed', 'skipped', 'testsAdded', 'filesChanged'],
  properties: {
    tool: { type: 'string', description: 'the FOLDER NAME only, e.g. math-assessment-tool' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    testsAdded: { type: 'integer', description: 'how many checks are in the tool\'s test file now' },
    fixed: {
      type: 'array',
      items: {
        type: 'object',
        required: ['what', 'how', 'howToSee'],
        properties: {
          what: { type: 'string', description: 'the defect, in a teacher\'s words' },
          how: { type: 'string', description: 'what was changed' },
          howToSee: { type: 'string', description: 'exact steps to see it working now' },
        },
      },
    },
    skipped: {
      type: 'array',
      items: {
        type: 'object',
        required: ['what', 'why'],
        properties: { what: { type: 'string' }, why: { type: 'string' } },
      },
    },
  },
}

const PROOF = {
  type: 'object',
  required: ['tool', 'allHold', 'results', 'newProblems'],
  properties: {
    tool: { type: 'string', description: 'the FOLDER NAME only' },
    allHold: { type: 'boolean' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'holds', 'evidence'],
        properties: {
          claim: { type: 'string' },
          holds: { type: 'boolean' },
          evidence: { type: 'string', description: 'what was actually observed' },
        },
      },
    },
    newProblems: {
      type: 'array',
      description: 'anything the fixes BROKE, or any regression',
      items: { type: 'string' },
    },
  },
}

const HARNESS = `
DRIVE A REAL BROWSER for everything you claim. Do not reason about the code and predict.
  - puppeteer-core is installed at ${TESTDIR}/node_modules
  - Chrome: '${CHROME}'
  - Serve over a local http server on 127.0.0.1 (node's http module). http, NOT file:// —
    Chrome blocks localStorage on file:// and saving is part of what matters here.
  - A complete working harness — server, launch, stubbing window.print/open/confirm/alert,
    capturing page and console errors — is at the top of ${REF_TESTS}. Read it and copy it.
  - Favicon 404s are noise; the URL is in m.location().url, not the message text.
`

// Sahaj's decisions, and they override any finding that contradicts them.
const RULES = `
SAHAJ'S STANDING DECISIONS — these override any audit finding that says otherwise:

1. NO REAL CHILD DATA, EVER. Where a tool needs to identify who was assessed, copy the pattern
   already chosen in ${REFERENCE}: a short INITIALS field (maxlength 4) and a date, plus the
   "Stays on this laptop" badge. Never a full name field, never anything sent anywhere.

2. A SAMPLE STUDENT, AND SHE IS NAMED. Every assessment tool gets a clearly-labelled
   "Try it with a sample student" button that fills the tool with plausible made-up scores, so a
   visitor who has never seen it sees the charts and the report populated on arrival.
     - The sample child is **Maya Torres**, initials **M.T.** Use exactly that in every tool, so
       the suite is consistent for anyone clicking through more than one.
     - She must be UNMISTAKABLY an example. Label her on screen ("Sample student — Maya Torres")
       and carry that label into any export, so a printed sheet can never be taken for a real
       child's record.
     - One click clears her again and returns the tool to empty.
     - Give her a believable, MIXED profile — some skills strong, some not. A child who scores
       the same on everything shows a visitor nothing, and it is not what real data looks like.
       Do not make her perfect.

3. THE DECODABLE PASSAGE GENERATOR IS DESKTOP-FIRST ON PURPOSE. Do NOT rebuild it for phones.
   Teachers use a computer for it and tapping it on a tablet is the wrong gesture. The ONLY
   change allowed there for small screens is a short, polite line telling a visitor it is built
   for a computer, so a phone shows an explanation rather than 6-point type.

4. NOTHING LEAVES THE LAPTOP. No new network calls, no analytics, no uploads.

5. MATCH THE TOOL'S OWN VOICE. Sahaj writes plainly, for teachers, without jargon. Read the
   surrounding copy before you write any user-facing text, and match it. Never write "Error:" or
   "Invalid input" — say what happened and what to do, the way ${REFERENCE} does.
`

const FAMILY = `
THESE DEFECTS RUN THROUGH THE WHOLE FAMILY OF TOOLS. Check every one against YOUR tool, fix the
ones that apply, and say in "skipped" if one genuinely does not:

  a. THE CHART GOES BLANK when every scored skill sits in the same band — including right after
     the first click a visitor makes. A pie or donut with one slice must still draw. This is a
     real reading, not just a demo problem.
  b. NO NAME AND NO DATE anywhere, on screen or in the export, and every export file has the same
     filename. Fix per rule 1 above, and put the initials and date into the export AND the
     filename.
  c. NOTHING SURVIVES A REFRESH. Scores are lost on reload. Save to localStorage, and wrap
     every localStorage call in try/catch — Safari private windows and a full disk both throw,
     and a silent failure here loses a teacher's whole assessment. Say so on screen if it fails.
  d. "CLEAR" DESTROYS EVERYTHING on one click with no confirmation and no undo. Copy the pattern
     in ${REFERENCE}: confirm first, and tell the teacher how to get it back.
  e. EXPORT PDF DIES SILENTLY when its CDN scripts do not load — a school firewall, an outage, a
     plane. At minimum, detect it and tell the user plainly what happened and what still works
     (printing, CSV). Never a dead button and a console error nobody sees.
  f. EXPORT CSV DROPS THE COMMENTS it just read, and columns can come out empty. Every field on
     screen belongs in the export, and quotes/commas/newlines must be escaped properly.
  g. A COMMENT TYPED IN A BOX IS LOST unless the box is blurred first. Save on input, not on blur.
  h. A MIS-CLICKED SCORE CANNOT BE TAKEN BACK except by wiping the form. Let a score be cleared.
`

log('Fixing ' + TOOLS.length + ' tools — one agent each, then an independent prover')

phase('Fix')
const results = await pipeline(
  TOOLS,

  // ---- Stage 1: fix ------------------------------------------------------
  t => agent(`You OWN the folder ${REPO}/${t.tool}/ for this task. Do not edit any file outside it.
Other agents are working on sibling folders at the same time — staying inside yours is what keeps
you from colliding with them.

An audit already drove this tool in a real browser. ITS FINDINGS ARE YOUR STARTING POINT:
read ${AUDIT} and take the entry keyed "${t.tool}". That object has a
recruiterVerdict and a findings array, each with a severity, a summary, the exact steps that
reproduce it, and what was observed versus expected. Read every finding for your tool before you
change anything. Ignore the other tools' entries — they belong to other agents.

${RULES}

${FAMILY}

${HARNESS}

DO THIS:
1. Read the tool's own code and copy first. It is a single HTML file. Match its existing style,
   naming and voice; do not restructure it, do not add a build step, do not add dependencies, and
   keep it a single self-contained file that works by opening it.
2. Fix every finding above that is real, plus every item in the family list that applies.
   Where an audit finding contradicts one of Sahaj's standing decisions, follow the decision and
   record it under "skipped" with the reason.
3. Where you change something subtle, leave a short comment saying WHAT WAS WRONG — the way
   ${REFERENCE} does. A future reader must not undo the fix by accident.
4. WRITE A TEST FILE at ${REPO}/${t.tool}/tests/run-tests.js, modelled exactly on
   ${REF_TESTS}: a real browser, real clicks, one check per defect you fixed, named for what a
   PERSON would notice ("the chart still draws when every skill is the same level"), not for the
   function involved. Add a tests/package.json with {"scripts":{"test":"node run-tests.js"}} and
   puppeteer-core as a dependency. Do NOT run npm install — reuse ${TESTDIR}/node_modules by
   requiring with NODE_PATH, or symlink it; say which you did.
5. RUN your test file and iterate until every check passes. Do not report a fix you have not seen
   pass in a browser.

Report the folder name only in "tool" — e.g. "${t.tool}" — never a description of your harness.`,
    { label: 'fix:' + t.tool, phase: 'Fix', schema: FIXED, model: MODEL }),

  // ---- Stage 2: prove, by someone who did not do the work ----------------
  (fixReport, t) => {
    if (!fixReport) return null
    return agent(`Independently PROVE OR DISPROVE that a set of fixes actually works in
${REPO}/${t.tool}/index.html. You did not make these changes and you should not trust them.

The agent that made them claims:
${JSON.stringify(fixReport.fixed, null, 1)}

${HARNESS}

For EACH claim: follow its "howToSee" steps yourself in a real browser and record what you
actually observe. Set holds=false for anything you cannot reproduce — a claim you could not
verify is not a fix.

Then look for damage the fixes may have done, which matters as much as whether they worked:
  - Load the tool cold and check for JavaScript errors and console errors.
  - Exercise EVERY button, select and input. Anything dead, anything that throws?
  - Scan all rendered text and every export for: undefined, NaN, Infinity, [object Object], null.
  - If it saves to localStorage: save, reload, confirm it comes back; then corrupt the stored
    value and confirm it fails politely instead of crashing.
  - Run the tool's own test file (cd ${REPO}/${t.tool}/tests && node run-tests.js) and report
    whether it genuinely passes.
  - Check any sample-student feature really populates the charts, is clearly labelled an example,
    and clears again.

Report the folder name only in "tool" — "${t.tool}".
Do NOT edit any file. You are the check, not the author.`,
      { label: 'prove:' + t.tool, phase: 'Prove', schema: PROOF, model: MODEL })
      .then(proof => ({ tool: t.tool, fixReport, proof }))
  },

  // ---- Stage 3: one repair pass for whatever did not hold ----------------
  (r) => {
    if (!r || !r.proof) return r
    const broken = (r.proof.results || []).filter(x => !x.holds)
    const damage = r.proof.newProblems || []
    if (!broken.length && !damage.length) return r
    return agent(`You own ${REPO}/${r.tool}/ again. An independent check found that some of the
fixes do not hold up, and/or that something else broke. Put it right.

DID NOT HOLD:
${JSON.stringify(broken, null, 1)}

BROKEN OR NEWLY WRONG:
${JSON.stringify(damage, null, 1)}

${RULES}

${HARNESS}

Fix these specifically. Re-run the tool's test file at ${REPO}/${r.tool}/tests/run-tests.js and
add a check for anything that was not caught the first time — that omission is why it slipped
through. Report only what you have SEEN pass in a browser.

Report the folder name only in "tool" — "${r.tool}".`,
      { label: 'repair:' + r.tool, phase: 'Re-fix', schema: FIXED, model: MODEL })
      .then(repair => ({ ...r, repair }))
  }
)

const done = results.filter(Boolean)
log(done.length + ' of ' + TOOLS.length + ' tools completed the full fix-and-prove cycle')

phase('Report')
const report = await agent(`Write the summary for Sahaj Kashyap — a teacher of 14 years who builds
these tools and is applying for edtech jobs. Plain language; define any technical word in one line
the first time. He is not a software engineer by training.

Every tool below was fixed by one agent and then independently checked by another:
${JSON.stringify(done.map(d => ({
    tool: d.tool,
    fixed: d.fixReport && d.fixReport.fixed,
    skipped: d.fixReport && d.fixReport.skipped,
    testsAdded: d.fixReport && d.fixReport.testsAdded,
    proofHeld: d.proof && d.proof.allHold,
    didNotHold: d.proof && (d.proof.results || []).filter(x => !x.holds),
    newProblems: d.proof && d.proof.newProblems,
    repaired: d.repair && d.repair.fixed,
  })), null, 1)}

Write:

1. WHAT IS FIXED, tool by tool — short, concrete, in terms of what a teacher or a recruiter would
   now see. For each tool give the live URL
   (https://sahajkashyap.github.io/edtech-portfolio/<folder>/) and ONE sentence on what to click
   to see it working.

2. SAFE TO SEND — the tools he can put in front of a hiring manager today, named plainly.

3. STILL OPEN — anything that did not hold up, or was deliberately not done, and why. Be blunt.
   Do not soften this; he would rather know.

4. WHAT TO CHECK HIMSELF — the two or three things most worth his own eyes, since his judgement
   about what teachers need is better than any agent's.

Be direct and do not pad. If something is fine, say so in one line and move on.`,
  { label: 'summary', phase: 'Report', model: MODEL })

return {
  toolsAttempted: TOOLS.length,
  toolsCompleted: done.length,
  perTool: done.map(d => ({
    tool: d.tool,
    fixedCount: d.fixReport ? (d.fixReport.fixed || []).length : 0,
    testsAdded: d.fixReport ? d.fixReport.testsAdded : 0,
    proofHeld: d.proof ? d.proof.allHold : null,
    stillOpen: d.proof ? (d.proof.results || []).filter(x => !x.holds).map(x => x.claim) : [],
    newProblems: d.proof ? d.proof.newProblems : [],
  })),
  report,
}
