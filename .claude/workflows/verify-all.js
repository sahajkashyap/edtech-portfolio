export const meta = {
  name: 'verify-all',
  description: 'Run the four-phase verification over several tools, one after another',
  whenToUse: 'Say "verify all my tools". Runs verify-everything for each tool in turn and collects the findings in one place.',
  phases: [
    { title: 'Verify each tool', detail: 'the full hunt/refute/test loop, one tool at a time' },
    { title: 'Collect',          detail: 'one ranked list across every tool' },
  ],
}

// ---------------------------------------------------------------------------
// WHY ONE AT A TIME
//
// Each verification drives real Chrome windows. Running eleven of them at once
// would put dozens of browsers on one laptop and make every timing measurement
// meaningless — and timing is exactly what several of these checks are about.
// So the tools go through in sequence. It is slower in wall-clock and it is the
// only way the results mean anything.
//
// The round ceiling is deliberately lower than a single-tool run. Six rounds on
// one tool cost 343 agents; eleven tools at that depth would exhaust the run
// before it finished. Three rounds each finds the things a person would hit,
// and any tool that is still producing findings at three rounds is flagged as
// NOT converged so it can be given the deep treatment on its own.
// ---------------------------------------------------------------------------

const cfg    = (typeof args === 'string') ? JSON.parse(args) : (args || {})
const TOOLS  = cfg.tools || []
const ROUNDS = cfg.maxRounds || 3
const DRY    = cfg.dryRounds || 2
const MODEL  = cfg.model || 'opus'

const results = []

phase('Verify each tool')
for (let i = 0; i < TOOLS.length; i++){
  const tool = TOOLS[i]
  log(`(${i + 1}/${TOOLS.length}) verifying ${tool}`)
  try {
    // By PATH, not by name. Name lookup resolves relative to wherever the
    // terminal happens to be sitting, and returned "not found" when that was
    // not this repo.
    const r = await workflow({ scriptPath:
      '/Users/sahajkashyap/Documents/GitHub/edtech-portfolio/.claude/workflows/verify-everything.js' }, {
      target: tool, dryRounds: DRY, maxRounds: ROUNDS, model: MODEL,
    })
    results.push({ tool, ok: true, ...r })
    log(`${tool}: ${r.confirmedCount} confirmed, ` +
        (r.converged ? 'converged' : 'DID NOT converge') +
        (r.incompleteBecause ? ' — ' + r.incompleteBecause : ''))
  } catch (e) {
    results.push({ tool, ok: false, error: String(e && e.message || e) })
    log(`${tool}: verification failed to run — ${e && e.message}`)
  }
}

phase('Collect')
const summary = await agent(`Write the state-of-the-portfolio note for Sahaj Kashyap — a teacher
of 14 years who builds these tools and is applying for edtech jobs. Plain language, and define any
technical word in one line the first time. He is not a software engineer by training.

Every tool below was put through the same verification: four agents hunting along different
lenses, three sceptics trying to kill each finding, and the whole thing repeated until two rounds
in a row found nothing new — or until it hit a ${ROUNDS}-round ceiling.

${JSON.stringify(results.map(r => ({
  tool: r.tool,
  ranOk: r.ok,
  error: r.error,
  rounds: r.rounds,
  converged: r.converged,
  incompleteBecause: r.incompleteBecause,
  confirmed: (r.confirmed || []).map(f => ({
    id: f.id, severity: f.severity, reachable: f.reachableByTeacher, summary: f.summary,
  })),
  unverified: (r.unverified || []).map(f => f.id),
})), null, 1)}

Write:

1. THE SHORT ANSWER — how many tools came back clean, how many have things a teacher would hit,
   and whether any tool is in bad enough shape that a link to it should come down today.

2. TOOL BY TOOL — one short paragraph each, worst first. What a real person would hit, in their
   words, not defect ids. Say plainly which tools CONVERGED (two quiet rounds — as close to "there
   is nothing left" as this method gets) and which hit the ceiling still finding things, because
   those two mean very different things.

3. FIX FIRST — if there were one working day, which tools and which defects, and why those.

4. THE PATTERN — anything that showed up across several tools. That is the reusable lesson and
   it is worth more than any single fix.

5. WHAT SAHAJ SHOULD CHECK HIMSELF — two or three things where his judgement about what a teacher
   needs beats any agent's.

Be direct. Do not pad, do not cheerlead, and do not soften bad news — he would rather know.`,
  { label: 'portfolio-state', phase: 'Collect', model: MODEL })

return {
  toolsVerified: results.filter(r => r.ok).length,
  toolsFailed: results.filter(r => !r.ok).map(r => ({ tool: r.tool, error: r.error })),
  converged: results.filter(r => r.ok && r.converged).map(r => r.tool),
  notConverged: results.filter(r => r.ok && !r.converged).map(r => r.tool),
  totalConfirmed: results.reduce((n, r) => n + ((r.confirmed || []).length), 0),
  perTool: results.map(r => ({
    tool: r.tool, rounds: r.rounds, converged: r.converged,
    confirmed: (r.confirmed || []).length,
    reachable: (r.confirmed || []).filter(f => f.reachableByTeacher).length,
    blockers: (r.confirmed || []).filter(f => f.severity === 'BLOCKER').length,
  })),
  summary,
}
