export const meta = {
  name: 'verify-everything',
  description: 'Hunt, refute, write tests, and loop until two rounds find nothing new',
  whenToUse: 'Say "ultracode verify <folder>" to run a full verification of one tool. Use before showing a tool to anyone, or after any substantial change. Keeps going until it stops finding things.',
  phases: [
    { title: 'Hunt',    detail: 'four agents, four different lenses, in parallel' },
    { title: 'Refute',  detail: 'three skeptics per finding try to kill it' },
    { title: 'Tests',   detail: 'survivors become test code in run-tests.js style' },
    { title: 'Verdict', detail: 'what is real, what to fix first, whether it converged' },
  ],
}

// ---------------------------------------------------------------------------
// WHAT THIS IS, in plain language
//
// A review that reads code is SAMPLING, not covering: each pass follows a
// different path, nothing remembers the last pass, so pass eleven still finds
// new things. "Find the bugs" has no finish line.
//
// This gives it one. Four agents hunt along four DIFFERENT lenses so they are
// not all looking in the same place. Everything they claim is handed to three
// skeptics whose job is to KILL it, so plausible-but-wrong findings die before
// they reach you. What survives is written up as test code. Then it goes round
// again — and only stops when two consecutive rounds turn up nothing new.
//
// That last part is the whole point. It does not stop after a set number of
// tries. It stops when the trying stops producing.
// ---------------------------------------------------------------------------

const REPO    = '/Users/sahajkashyap/Documents/GitHub/edtech-portfolio'
const CHROME  = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const TESTDIR = REPO + '/running-record-tool/tests'

const cfg     = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const TARGET  = cfg.target || 'running-record-tool'

// Fable 5 for the hunting and the refuting. This is the hard, sceptical part of
// the job — reproducing a bug in a real browser and then arguing it down — and
// it is where the deepest findings came from when it was tried by hand. Set
// `model: 'inherit'` in args to fall back to whatever model the session is on.
const MODEL   = (cfg.model === 'inherit') ? undefined : (cfg.model || 'fable')
const DRY_ROUNDS_TO_STOP = cfg.dryRounds || 2
const MAX_ROUNDS = cfg.maxRounds || 4
const APP     = REPO + '/' + TARGET + '/index.html'
const SUITE   = REPO + '/' + TARGET + '/tests/run-tests.js'

const FINDINGS = {
  type: 'object',
  required: ['findings', 'whatIRan', 'ruledOut'],
  properties: {
    whatIRan: { type: 'string', description: 'concretely what was executed, and how many cases' },
    ruledOut: { type: 'string', description: 'categories genuinely exercised that produced nothing' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'severity', 'summary', 'repro', 'observed', 'reachableByTeacher'],
        properties: {
          id: { type: 'string', description: 'short kebab-case slug, stable across rounds' },
          severity: { type: 'string', enum: ['BLOCKER', 'BUG', 'MINOR', 'COSMETIC'] },
          summary: { type: 'string' },
          repro: { type: 'string', description: 'exact steps ACTUALLY EXECUTED in a browser' },
          observed: { type: 'string', description: 'observed versus expected' },
          file: { type: 'string', description: 'file:line' },
          reachableByTeacher: { type: 'boolean', description: 'normal use, or contrived input' },
        },
      },
    },
  },
}

const VERDICT = {
  type: 'object',
  required: ['refuted', 'why'],
  properties: {
    refuted: { type: 'boolean', description: 'true if it does NOT hold up' },
    why: { type: 'string' },
    correctedSeverity: { type: 'string', enum: ['BLOCKER', 'BUG', 'MINOR', 'COSMETIC'] },
  },
}

// The browser harness every agent must use. Reasoning about code is what let
// these bugs survive ten review passes; only execution counts here.
const HARNESS = `
DRIVE A REAL BROWSER. Do not read the code and predict what it does — run it.

  - puppeteer-core is installed at ${TESTDIR}/node_modules
  - Chrome: '${CHROME}'
  - Serve the folder over a local http server on 127.0.0.1 (node's own http module).
    http, NOT file:// — Chrome blocks localStorage on file:// and that is half of what matters.
  - A complete working harness — local server, launch, stubbing window.print/open/confirm/alert,
    counting live timers, capturing page and console errors — is at the top of
    ${SUITE}. READ IT FIRST and copy the boilerplate.
  - Favicon 404s are noise: the URL is in m.location().url, not the message text.

EVERY finding must be REPRODUCED, with the exact steps you ran and observed-versus-expected.
A finding you did not execute is not a finding. Do NOT edit any file.
"I found nothing" after a genuine hunt is a valuable, acceptable answer — never invent findings.
`

// Four deliberately different lenses. Redundant hunters find redundant bugs;
// the point of four is that each is blind to what the others see.
const LENSES = [
  { key: 'runtime', prompt: `State and timing. Every control, every keyboard key, every clock
transition (idle/running/paused/done) and every ordering between them. Orphaned timers, double
starts, actions that leave the clock in a state nothing on screen reports. Sequences no test tried:
undo after a lesson switch, deleting the record you are in, acting inside the save debounce.` },

  { key: 'consistency', prompt: `Cross-surface agreement. Wherever the same number is computed in
more than one place — the screen, the printed page, an exported file, a saved record — prove they
can never disagree. Enumerate ALL items/lessons/modes rather than sampling. Boundary values are
where this breaks: rounding cut-offs, exactly-at-the-threshold, zero, one, and the last item.` },

  { key: 'data', prompt: `Saved data. Round-trip everything through save and reload and prove
nothing is lost or changed. Then corrupt storage the way a real browser would: a missing body for a
listed record, a number stored as text, an out-of-range index, a null array, an entry pointing at
nothing. The tool must refuse clearly, never silently do the wrong arithmetic.` },

  { key: 'firstcontact', prompt: `A stranger's first two minutes. Load it cold with no prior
knowledge. Is anything unreachable, unlabelled, or unexplained? Every link: does it open, or does it
download? Case-sensitivity on paths (GitHub Pages is case-sensitive, a Mac is not). Narrow screens —
an iPad in portrait is what a teacher actually holds. Print output. Anything a hiring manager would
see that would embarrass this.` },
]

log('Verifying ' + TARGET + ' — will stop after ' + DRY_ROUNDS_TO_STOP +
    ' consecutive rounds that find nothing new')

const seen = new Set()
const confirmed = []
const testCode = []
let dry = 0, round = 0

while (dry < DRY_ROUNDS_TO_STOP && round < MAX_ROUNDS){
  round++
  log('--- Round ' + round + ' ---')

  // ---- Phase 1: hunt, four lenses at once -------------------------------
  phase('Hunt')
  const already = [...seen].join(', ') || '(nothing yet)'
  const hunts = (await parallel(LENSES.map(L => () =>
    agent(`Try to break the tool at ${APP}. It is a single-file HTML classroom tool.

YOUR LENS FOR THIS PASS — stay on it, the other lenses are covered by other agents:
${L.prompt}

${HARNESS}

There is an existing test suite at ${SUITE}. READ IT FIRST and run it
(cd ${TESTDIR} && npm test). Anything it already checks is OUT OF SCOPE — do not re-report it.
Also run \`npm run coverage\`: 100% line coverage does NOT mean 100% correctness, and the gap
(branches only half-taken, boundary values, orderings) is exactly where you should hunt.

Findings already known this run, do NOT report them again: ${already}

Give each finding a short stable id slug so it can be recognised across rounds.
Say plainly whether a teacher could hit it in normal use, or whether it needs contrived input.`,
      { label: 'hunt:' + L.key, phase: 'Hunt', schema: FINDINGS, model: MODEL })
  ))).filter(Boolean)

  const fresh = hunts.flatMap(h => h.findings || []).filter(f => !seen.has(f.id))
  log('Round ' + round + ': ' + fresh.length + ' new finding(s) across four lenses')

  if (!fresh.length){
    dry++
    log('Nothing new — ' + dry + ' of ' + DRY_ROUNDS_TO_STOP + ' quiet rounds')
    continue
  }
  dry = 0
  fresh.forEach(f => seen.add(f.id))

  // ---- Phase 2: three skeptics per finding, then Phase 3 for survivors ---
  // A pipeline, not a barrier: a finding that clears the skeptics gets written
  // up while the others are still being argued over.
  const results = await pipeline(
    fresh,
    f => parallel([0, 1, 2].map(k => () =>
      agent(`Try to REFUTE this claim about ${APP}. Default to refuted unless you reproduce it
yourself, from scratch. You are the ${['correctness', 'reachability', 'severity'][k]} check:
${['Is the stated behaviour actually what happens, or did the reporter misread their own output?',
   'Can a teacher reach this in ordinary use, or only by calling internals / hand-editing storage?',
   'Is the severity honest, or is a small thing being over-graded (or a serious one under-graded)?'][k]}

CLAIM: ${f.summary}
STEPS: ${f.repro}
OBSERVED: ${f.observed}

${HARNESS}

Run the steps yourself before answering. Set refuted true if it does not hold up.`,
        { label: 'refute:' + f.id, phase: 'Refute', schema: VERDICT, model: MODEL })
    )).then(vs => {
      const good = vs.filter(Boolean)
      // Majority rules. One dissenting skeptic does not kill a real bug, and
      // one credulous one does not let a phantom through.
      const kills = good.filter(v => v.refuted).length
      return { f, survives: good.length > 0 && kills < 2, votes: good }
    }),
    r => {
      if (!r.survives) return r
      return agent(`Write the test that would catch this, for the suite at ${SUITE}.

FINDING: ${r.f.summary}
STEPS: ${r.f.repro}
OBSERVED: ${r.f.observed}

Read ${SUITE} first and match its style exactly: a group('...') followed by
check(...) / eq(...) calls, driving the page with real clicks and keypresses. Name each check for
what a PERSON would notice — "deleting a record does not bring it back", never "test deleteRecord".
Include the one-line comment explaining what was once broken, in the style of the file.

Return ONLY the code block, ready to paste. Do not edit any file.`,
        { label: 'test:' + r.f.id, phase: 'Tests', model: MODEL })
        .then(code => ({ ...r, code }))
    }
  )

  results.filter(Boolean).filter(r => r.survives).forEach(r => {
    confirmed.push(r.f)
    if (r.code) testCode.push({ id: r.f.id, summary: r.f.summary, code: r.code })
  })
  const killed = results.filter(Boolean).filter(r => !r.survives).length
  log('Round ' + round + ': ' + (fresh.length - killed) + ' survived, ' + killed + ' refuted')
}

if (round >= MAX_ROUNDS && dry < DRY_ROUNDS_TO_STOP)
  log('Stopped at the ' + MAX_ROUNDS + '-round ceiling WITHOUT going quiet — it had not converged.')

phase('Verdict')
const verdict = await agent(`Write the summary for Sahaj Kashyap, a teacher of 14 years who builds
classroom tools and is applying for edtech jobs. Not a software engineer by training: plain
language, and define any technical word in one line the first time you use it.

Tool verified: ${TARGET}
Rounds run: ${round}. Consecutive quiet rounds at the end: ${dry} (target was ${DRY_ROUNDS_TO_STOP}).
Findings that survived three skeptics each:
${JSON.stringify(confirmed, null, 1)}

Write:
1. WHAT IS ACTUALLY BROKEN — plain sentences, worst first, each with what a teacher would see.
   Separate the ones reachable in normal use from the ones needing contrived input.
2. FIX FIRST — if there were only twenty minutes, which one, and why that one.
3. DID IT CONVERGE — say plainly whether the hunt went quiet or was still finding things when it
   stopped. If it did not converge, say so; that is the honest and useful answer.
4. WHAT WAS RULED OUT — what was genuinely exercised and found clean, so Sahaj knows what IS solid.

Be direct. Do not pad. If nothing was found, say the tool held up and say what was tried.`,
  { label: 'verdict', phase: 'Verdict' })

return {
  tool: TARGET,
  rounds: round,
  converged: dry >= DRY_ROUNDS_TO_STOP,
  confirmedCount: confirmed.length,
  confirmed,
  testCode,
  verdict,
}
