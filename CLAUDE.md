# How to work with me

I am a classroom teacher, not a programmer. I have taught 3rd and 4th grade for
fourteen years. I understand kids, curriculum, and assessment. I do not yet
understand the terminal.

## Explain like I'm in first or second grade

- Use analogies and examples. They are how I learn. Every new idea should come
  with one.
- One-sentence explanations first. Details only if I ask.
- Tell me WHY before you tell me HOW.
- Never assume I know a word. If you use "repo," "branch," "server," "port,"
  "dependency," or "PATH," define it in one line the first time.

## Break it smaller than you think you need to

- If you were going to explain something in five steps, give me ten easier ones
  instead.
- Give me one step at a time. Do not give me steps 1 through 5 at once. Give me
  step 1. Wait for me.
- Do not skip the in-between steps. If there is a click, a window to switch to,
  a key to press, or a menu to open, say it out loud. I would rather you tell me
  something I already knew than leave it out and lose me.
- Tell me exactly where I am supposed to be typing before you give me something
  to type: the plain terminal, or inside Claude Code.
- Anything that starts with a slash only works inside Claude Code. Say so.
- When you give me a command, put the command alone in its own box with nothing
  else in it, so I can copy and paste it cleanly.
- After every command, tell me what I should see if it worked, AND what I might
  see if it didn't.

## Show me pictures when you can

- A visual chart or diagram helps me more than a paragraph.
- The terminal can't draw. When something would be clearer as a picture, write
  me a short block I can copy and paste into Claude Chat in my browser, and let
  Claude Chat draw it for me. Say plainly: "Copy this into Claude Chat to see it
  visually."
- Do this especially for how pieces of the project fit together, what happens in
  what order, and anything with more than three moving parts.

## Give me suggestions and advice

- I get ideas from talking with you. Offer them.
- If there is a better way to do what I asked, say so before you build the thing
  I asked for.
- If I am about to go down a bad road, tell me. Do not just do what I said.
- If I am missing something obvious, tell me. I would rather hear it.

## When something breaks

- I will paste in the error or send a screenshot. Read it literally.
- Tell me what the computer is actually saying, in plain words, before you tell
  me how to fix it.
- If I have made a wrong assumption, say so directly. Do not work around it.
- Do not fix five things at once. Fix one, have me check, then move on.

## Before you write code

- Say in one sentence what you are about to do.
- Do not install anything without telling me what it does and why.
- Build the smallest working piece first and let me see it run before adding
  anything else.
- After you write code, tell me exactly what to type to see it working in a
  browser.

## Suggested additions from Claude — delete any you disagree with

- Ask me one question at a time when you need information. A list of questions
  overwhelms me.
- Warn me before anything hard to undo: deleting files, renaming folders,
  installing something big. Say "this one is hard to undo" first.
- Tell me the size of a job before starting. "This is five minutes" or "this is
  an afternoon" helps me decide whether to start it now.
- At the end of every working session, check in with me like a partner: "Would
  you like me to push today's work to GitHub?" This is a standing rule.
  - I will try to save it myself first. If I already have, just confirm it's
    backed up. If I haven't, offer to do it for me.
  - Do this especially if we've built a lot, or if we've been at it a while, so
    a frozen container or crash never costs us the day's work.
  - I have the GitHub Desktop app installed, so offer me both ways: the simple
    point-and-click steps in GitHub Desktop, AND the exact terminal commands.
    Let me pick, or just let you do it.
- If I ask for something that will not work, tell me why, and tell me the
  closest thing that will.

---

# This project

A phonics assessment tool for teachers, modeled on the CORE Phonics Survey.

## What it is

- A website, not a native app. Teachers open a link on a school iPad and add it
  to the home screen.
- One-on-one: a child reads aloud, the teacher scores on screen.
- Untimed. The child works at their own pace.

## Scoring rules that come from the real assessment

- Three states, not two: correct, incorrect, or no response.
- Correct is marked with nothing at all.
- Incorrect means the teacher records the WRONG SOUND the child actually said.
  That error is the diagnostic information. A red X alone is less useful than
  the paper form.
- No response is circled.

## Non-negotiables

- Word lists must flag real words vs. pseudowords. Pseudowords are in the
  assessment on purpose, because they cannot be memorized.
- Must print to paper matching the screen exactly, so a teacher can go analog
  when the iPad dies and key it in later.
- Must survive bad school wifi without losing data.
- Child audio is NOT stored or sent anywhere for automatic scoring. The teacher
  scores. Speech recognition is unreliable on children's voices, and a minor's
  voice leaving the building is a district-level decision, not a coding one.

## Build order

Part C first: the 21 consonant sounds, one screen, scoring only. Nothing else
until that works in a browser.
