export const meta = {
  name: 'reprove',
  description: 'Re-prove each tool after its repairs, and decide tool by tool whether it can ship',
  whenToUse: 'After a fix pass that included repairs. Repairs made after the proving round are unverified until this runs.',
  phases: [
    { title: 'Re-prove', detail: 'one agent per tool, checking the repairs and sweeping for damage' },
    { title: 'Last fix',  detail: 'anything still not shippable gets one final targeted pass' },
    { title: 'Verdict',   detail: 'ship or hold, tool by tool' },
  ],
}

const REPO    = '/Users/sahajkashyap/Documents/GitHub/edtech-portfolio'
const CHROME  = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const NODEMODS = REPO + '/running-record-tool/tests/node_modules'
const REF_TESTS = REPO + '/running-record-tool/tests/run-tests.js'

const cfg    = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const TOOLS  = cfg.tools || []
const OPEN   = cfg.openItemsFile
const MODEL  = (cfg.model === 'inherit') ? undefined : (cfg.model || 'opus')

const SHIP = {
  type: 'object',
  required: ['tool', 'shipReady', 'why', 'checked', 'stillWrong'],
  properties: {
    tool: { type: 'string', description: 'the FOLDER NAME only, e.g. factor-field' },
    shipReady: {
      type: 'boolean',
      description: 'true ONLY if a stranger can use this tool today without hitting anything broken',
    },
    why: { type: 'string', description: 'one or two plain sentences justifying the decision' },
    checked: { type: 'string', description: 'concretely what was driven, and how many things' },
    stillWrong: {
      type: 'array',
      items: {
        type: 'object',
        required: ['what', 'severity', 'reachable'],
        properties: {
          what: { type: 'string' },
          severity: { type: 'string', enum: ['BLOCKER', 'BUG', 'MINOR', 'COSMETIC'] },
          reachable: { type: 'boolean', description: 'can an ordinary user hit it' },
          where: { type: 'string', description: 'file:line if known' },
        },
      },
    },
  },
}

const HARNESS = `
DRIVE A REAL BROWSER for every claim. Do not reason about the code and predict.
  - puppeteer-core: ${NODEMODS} (run with NODE_PATH=${NODEMODS} node yourscript.js)
  - Chrome: '${CHROME}'
  - Serve over a local http server on 127.0.0.1 (node's http module). NOT file://.
  - Working harness to copy: the top of ${REF_TESTS}
  - Favicon 404s are noise; the URL is in m.location().url, not the message text.
`

log('Re-proving ' + TOOLS.length + ' tools after their repairs')

phase('Re-prove')
const results = await pipeline(
  TOOLS,

  t => agent(`Decide whether ${REPO}/${t}/index.html can go in front of a hiring manager TODAY.

This tool was audited, fixed, then independently checked — and THEN repaired again. Those last
repairs were never verified by anybody. That is what you are here for.

Read ${OPEN} and take the entry keyed "${t}". It contains:
  - openItems: claimed fixes that did NOT hold when checked
  - newProblems: damage or new defects the checker found
  - repairsClaimed: what the repair agent then said it fixed — UNVERIFIED, treat with suspicion

${HARNESS}

DO THIS, in order:
1. For every item in openItems and newProblems, drive the exact scenario yourself and record what
   you observe NOW. Say plainly whether it is fixed, still broken, or was never real.
2. For every repairsClaimed entry, verify it independently. A repair nobody checked is a claim.
3. Run the tool's own suite: cd ${REPO}/${t}/tests && NODE_PATH=${NODEMODS} node run-tests.js
   Report the count. THEN look for checks that pass while testing the WRONG MOMENT — one tool's
   suite read a printed value only after a page reload, so it passed while the real
   type-then-print path was broken. Name any check you find like that.
4. Fresh damage sweep: load cold and check for JS and console errors; exercise every button,
   select and input; scan all rendered text AND every export for undefined, NaN, Infinity,
   [object Object] and null; if it saves, save/reload/confirm, then corrupt the stored value and
   confirm it fails politely.
5. Check the sample student really is there: Maya Torres / M.T., a MIXED profile (not all one
   level), charts populated on arrival, visibly labelled a sample on screen AND in exports, and
   one click clears her. Confirm no export can pass as a real child's record.

Then set shipReady. Be strict: true ONLY if an ordinary visitor can use this today without
hitting anything broken. A cosmetic blemish is fine; anything that loses work, shows a wrong
number, or leaves a dead control is not.

Report the folder name only in "tool" — "${t}". Do NOT edit any file. You are the check.`,
    { label: 'reprove:' + t, phase: 'Re-prove', schema: SHIP, model: MODEL }),

  (verdict, t) => {
    if (!verdict) return { tool: t, verdict: null }
    const blocking = (verdict.stillWrong || [])
      .filter(x => x.reachable && x.severity !== 'COSMETIC')
    if (verdict.shipReady && !blocking.length) return { tool: t, verdict, repaired: null }
    return agent(`You own ${REPO}/${t}/ — do not edit outside it. This tool is being held back
from release because of the following, found by driving it in a real browser:

${JSON.stringify(blocking.length ? blocking : verdict.stillWrong, null, 1)}
Reviewer's reasoning: ${verdict.why}

${HARNESS}

Fix these. Keep it a single self-contained HTML file, match the tool's existing style and voice,
and leave a short comment saying what was wrong wherever the fix is not obvious.

Then add a check for EACH one to ${REPO}/${t}/tests/run-tests.js — and if an existing check
passed while this was broken, that check is testing the wrong moment: fix the check too, and say
which one it was. Run the suite until it is green
(cd ${REPO}/${t}/tests && NODE_PATH=${NODEMODS} node run-tests.js).

Report only what you have SEEN pass in a browser. Report the folder name only — "${t}".`,
      { label: 'lastfix:' + t, phase: 'Last fix', schema: SHIP, model: MODEL })
      .then(repaired => ({ tool: t, verdict, repaired }))
  }
)

const done = results.filter(Boolean)
const shipped = done.filter(d => (d.repaired || d.verdict) && (d.repaired || d.verdict).shipReady)
log(shipped.length + ' of ' + TOOLS.length + ' tools are ship-ready')

phase('Verdict')
const verdict = await agent(`Write the release decision for Sahaj Kashyap, a teacher of 14 years
who builds these tools and is applying for edtech jobs this week. Plain language; define any
technical word in one line the first time. He is not a software engineer by training.

Each tool below was audited, fixed, independently checked, repaired, and then re-checked:
${JSON.stringify(done.map(d => ({
  tool: d.tool,
  shipReady: (d.repaired || d.verdict || {}).shipReady,
  why: (d.repaired || d.verdict || {}).why,
  stillWrong: (d.repaired || d.verdict || {}).stillWrong,
  neededLastFix: !!d.repaired,
})), null, 1)}

Write:
1. GOING LIVE — the tools that are ready, each with its live URL
   (https://sahajkashyap.github.io/edtech-portfolio/<folder>/) and ONE sentence on what to click
   to see it working.
2. HELD BACK — any tool not ready, what is still wrong, and how big a job the remaining fix is.
   Be blunt; he would rather know.
3. WHAT SAHAJ SHOULD CHECK HIMSELF — the two or three things most worth his own eyes, because his
   judgement about what a teacher needs beats any agent's.
4. WHAT CHANGED ACROSS THE WHOLE SUITE — the handful of fixes that repeated in nearly every tool,
   since that is the reusable lesson.

Be direct, do not pad, no cheerleading.`,
  { label: 'release-decision', phase: 'Verdict', model: MODEL })

return {
  toolsChecked: done.length,
  ship: done.filter(d => (d.repaired || d.verdict || {}).shipReady).map(d => d.tool),
  hold: done.filter(d => !(d.repaired || d.verdict || {}).shipReady).map(d => ({
    tool: d.tool,
    why: (d.repaired || d.verdict || {}).why,
    stillWrong: (d.repaired || d.verdict || {}).stillWrong,
  })),
  verdict,
}
