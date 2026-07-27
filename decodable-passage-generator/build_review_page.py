#!/usr/bin/env python3
"""Turn sound-list.json into a page a teacher can actually read.

The JSON is the machine's copy. This is the human's copy — built from the same
file so the two can never disagree.

Run:  python3 build_review_page.py    -> writes sound-list-review.html
"""

import json
import pathlib

SRC = pathlib.Path(__file__).parent / "sound-list.json"
OUT = pathlib.Path(__file__).parent / "sound-list-review.html"


def compact(doc):
    flagged = {f["lesson"]: f["note"] for f in doc["flaggedForTeacherReview"]}
    rows, prev_hearts = [], []
    for L in doc["lessons"]:
        intro = L["introduces"]
        new_hearts = [w for w in L["allowedHeartWords"] if w not in prev_hearts]
        prev_hearts = L["allowedHeartWords"]
        rows.append({
            "n": L["lesson"], "skill": L["skill"],
            "unit": L["unit"].split(":")[0], "unitFull": L["unit"],
            "g": intro.get("graphemes", []), "sfx": intro.get("suffixes", []),
            "pfx": intro.get("prefixes", []), "pat": intro.get("patterns", []),
            "hearts": new_hearts, "note": intro.get("note", ""),
            "flag": L["lesson"] in flagged,
            "wb": L.get("requiresWordBank", []),
            "allG": L["allowedGraphemes"], "allH": L["allowedHeartWords"],
            "allP": L["allowedPatterns"],
            "allS": L["allowedSuffixes"] + L["allowedPrefixes"],
        })
    return rows


CSS = """
:root{
  --ink:#1B2430; --paper:#F4F6F7; --card:#FFFFFF; --line:#DDE3E7;
  --muted:#66727E; --vowel:#B23F28; --consonant:#2C5D86;
  --flag:#8F5D0F; --flag-bg:#FBF2DF; --flag-line:#E3CB98;
  --wb:#3F6B57; --wb-bg:#EAF2ED;
  --serif:"Iowan Old Style",Georgia,"Times New Roman",serif;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){
  :root{
    --ink:#E4EAEE; --paper:#121820; --card:#1A222C; --line:#2C3742;
    --muted:#8E9BA7; --vowel:#E58067; --consonant:#7FB2DE;
    --flag:#E0AC55; --flag-bg:#2A2318; --flag-line:#4E4128;
    --wb:#7FBFA0; --wb-bg:#18251F;
  }
}
:root[data-theme="dark"]{
  --ink:#E4EAEE; --paper:#121820; --card:#1A222C; --line:#2C3742;
  --muted:#8E9BA7; --vowel:#E58067; --consonant:#7FB2DE;
  --flag:#E0AC55; --flag-bg:#2A2318; --flag-line:#4E4128;
  --wb:#7FBFA0; --wb-bg:#18251F;
}
:root[data-theme="light"]{
  --ink:#1B2430; --paper:#F4F6F7; --card:#FFFFFF; --line:#DDE3E7;
  --muted:#66727E; --vowel:#B23F28; --consonant:#2C5D86;
  --flag:#8F5D0F; --flag-bg:#FBF2DF; --flag-line:#E3CB98;
  --wb:#3F6B57; --wb-bg:#EAF2ED;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);
  line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:64rem;margin:0 auto;padding:2.5rem 1.25rem 5rem}
h1,h2,h3{font-family:var(--serif);font-weight:600;text-wrap:balance;margin:0}
h1{font-size:clamp(1.9rem,4vw,2.7rem);line-height:1.15;letter-spacing:-.01em}
h2{font-size:1.35rem;margin-bottom:.2rem}
h3{font-size:1rem}
.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--muted);font-weight:600}
.lede{color:var(--muted);max-width:38em;margin:.7rem 0 0;font-size:1.02rem}
header{border-bottom:2px solid var(--ink);padding-bottom:1.6rem}
section{margin-top:2.8rem}
.sub{color:var(--muted);font-size:.9rem;margin:.15rem 0 1rem;max-width:44em}

/* summary */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));
  gap:.75rem;margin-top:1.6rem}
.stat{background:var(--card);border:1px solid var(--line);border-radius:3px;
  padding:.8rem .9rem}
.stat .v{font-family:var(--serif);font-size:1.7rem;line-height:1;
  font-variant-numeric:tabular-nums}
.stat .k{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted);margin-top:.4rem}
.stat.is-flag .v{color:var(--flag)}
.stat.is-wb .v{color:var(--wb)}

/* grapheme tiles */
.tile{display:inline-block;font-family:var(--mono);font-size:.86rem;
  padding:.13rem .42rem;border-radius:2px;border:1px solid var(--line);
  background:var(--card);margin:0 .22rem .22rem 0;white-space:nowrap}
.tile.v{color:var(--vowel);border-color:color-mix(in srgb,var(--vowel) 40%,var(--line))}
.tile.c{color:var(--consonant);border-color:color-mix(in srgb,var(--consonant) 40%,var(--line))}
.tile.w{font-family:var(--sans);color:var(--muted)}
.tiles{display:flex;flex-wrap:wrap;margin-top:.3rem}

/* flagged cards */
.flags{display:grid;gap:.75rem}
.flagcard{background:var(--flag-bg);border:1px solid var(--flag-line);
  border-left:3px solid var(--flag);border-radius:3px;padding:.85rem 1rem}
.flagcard .hd{display:flex;gap:.6rem;align-items:baseline;flex-wrap:wrap}
.flagcard .num{font-family:var(--serif);font-size:1.05rem;color:var(--flag)}
.flagcard .says{font-family:var(--mono);font-size:.82rem}
.flagcard p{margin:.45rem 0 0;font-size:.88rem;color:var(--ink)}

/* picker */
.picker{background:var(--card);border:1px solid var(--line);border-radius:3px;
  padding:1.1rem 1.15rem}
.pickrow{display:flex;gap:.9rem;align-items:center;flex-wrap:wrap}
.pickrow label{font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted);font-weight:600}
input[type=range]{flex:1;min-width:12rem;accent-color:var(--consonant)}
input[type=number]{width:4.5rem;font-family:var(--mono);font-size:1rem;
  padding:.3rem .45rem;border:1px solid var(--line);border-radius:2px;
  background:var(--paper);color:var(--ink)}
input:focus-visible,button:focus-visible{outline:2px solid var(--consonant);
  outline-offset:2px}
.picked{margin-top:1rem;border-top:1px solid var(--line);padding-top:.9rem}
.picked .title{font-family:var(--serif);font-size:1.2rem}
.grp{margin-top:.85rem}
.grp .lbl{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);font-weight:600}

/* lesson spine */
.unit{margin-top:1.9rem}
.unit .uh{display:flex;align-items:baseline;gap:.7rem;
  border-bottom:1px solid var(--ink);padding-bottom:.35rem;margin-bottom:.3rem}
.unit .uh .nm{font-family:var(--serif);font-size:1.05rem}
.unit .uh .rg{font-family:var(--mono);font-size:.78rem;color:var(--muted)}
.row{display:grid;grid-template-columns:3.1rem 1fr 4.5rem;gap:.7rem;
  padding:.5rem 0;border-bottom:1px solid var(--line);align-items:start}
.row:hover{background:var(--card)}
.row.flagged{background:var(--flag-bg)}
.row .ln{font-family:var(--mono);font-size:.82rem;color:var(--muted);
  font-variant-numeric:tabular-nums;padding-top:.15rem}
.row .sk{font-size:.9rem}
.row .sk .none{display:block;margin-top:.2rem;color:var(--muted);font-style:italic;font-size:.83rem}
.row .badge{display:inline-block;font-size:.66rem;letter-spacing:.08em;
  text-transform:uppercase;font-weight:700;padding:.05rem .32rem;border-radius:2px;
  vertical-align:.08em;margin-left:.35rem}
.badge.f{background:var(--flag);color:var(--paper)}
.badge.b{background:var(--wb);color:var(--paper)}
.row .meter{padding-top:.3rem}
.bar{height:4px;background:var(--line);border-radius:2px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--consonant)}
.row .cnt{font-family:var(--mono);font-size:.68rem;color:var(--muted);
  margin-top:.2rem;font-variant-numeric:tabular-nums}
.note{font-size:.8rem;color:var(--flag);margin-top:.25rem}

footer{margin-top:3.5rem;border-top:1px solid var(--line);padding-top:1rem;
  font-size:.8rem;color:var(--muted)}
@media (max-width:34rem){
  .row{grid-template-columns:2.6rem 1fr;}
  .row .meter{display:none}
}
"""

JS = """
const LESSONS = __DATA__;
const VOW = s => /^[aeiou_]+$/.test(s.replace(/_.*$/,''));
const maxG = Math.max(...LESSONS.map(l=>l.allG.length));

function tile(t, cls){
  const c = cls || (VOW(t) ? 'v' : 'c');
  return `<span class="tile ${c}">${t.replace(/_/g,' ')}</span>`;
}
function tiles(arr, cls){
  return arr.length ? `<div class="tiles">${arr.map(t=>tile(t,cls)).join('')}</div>` : '';
}

/* ---- the lesson spine ---- */
const spine = document.getElementById('spine');
let html = '', unit = null;
for(const L of LESSONS){
  if(L.unitFull !== unit){
    if(unit !== null) html += '</div>';
    unit = L.unitFull;
    const ns = LESSONS.filter(x=>x.unitFull===unit).map(x=>x.n);
    html += `<div class="unit"><div class="uh"><span class="nm">${unit}</span>`
         +  `<span class="rg">lessons ${Math.min(...ns)}\\u2013${Math.max(...ns)}</span></div>`;
  }
  const unlocks = [...L.g, ...L.sfx, ...L.pfx];
  const pats = L.pat.filter(p=>!['vc','cvc'].includes(p));
  let body = '';
  if(unlocks.length) body += tiles(unlocks);
  if(pats.length) body += tiles(pats, 'w');
  if(L.hearts.length) body += tiles(L.hearts.map(h=>'\\u2665 '+h), 'w');
  if(!body) body = '<span class="none">review &amp; practice \\u2014 nothing new</span>';
  const badges = (L.flag ? '<span class="badge f">check me</span>' : '')
               + (L.wb.length ? '<span class="badge b">word bank</span>' : '');
  const pct = Math.round(100*L.allG.length/maxG);
  html += `<div class="row${L.flag?' flagged':''}">
    <div class="ln">${L.n}</div>
    <div class="sk"><strong>${L.skill}</strong>${badges}${body}
      ${L.flag?`<div class="note">${L.note.replace(/FLAGGED for teacher review\\.?/,'').trim()}</div>`:''}</div>
    <div class="meter"><div class="bar"><i style="width:${pct}%"></i></div>
      <div class="cnt">${L.allG.length} sounds</div></div>
  </div>`;
}
html += '</div>';
spine.innerHTML = html;

/* ---- the picker ---- */
const range = document.getElementById('range');
const num = document.getElementById('num');
const out = document.getElementById('picked');

function show(n){
  const L = LESSONS[n-1];
  const wb = L.wb.length
    ? `<div class="grp"><div class="lbl">Needs an approved word list</div>
       ${L.wb.map(w=>`<div style="font-size:.85rem;margin-top:.2rem">
       <span class="tile v">${w.spelling}</span> its other sound is taught at Lesson
       ${w.secondSoundAt} \\u2014 ${w.why}</div>`).join('')}</div>` : '';
  out.innerHTML = `
    <div class="title">Lesson ${L.n} \\u2014 ${L.skill}</div>
    <div class="sub" style="margin:.15rem 0 0">${L.unitFull}</div>
    <div class="grp"><div class="lbl">Letters and letter teams a child can read
      (${L.allG.length})</div>${tiles(L.allG)}</div>
    <div class="grp"><div class="lbl">Heart words \\u2014 known by sight
      (${L.allH.length})</div>${tiles(L.allH,'w')}</div>
    ${L.allS.length?`<div class="grp"><div class="lbl">Word beginnings and endings</div>${tiles(L.allS,'w')}</div>`:''}
    ${L.allP.length?`<div class="grp"><div class="lbl">Patterns</div>${tiles(L.allP,'w')}</div>`:''}
    ${wb}`;
}
function sync(n){
  n = Math.min(128, Math.max(1, parseInt(n,10) || 1));
  range.value = n; num.value = n; show(n);
}
range.addEventListener('input', e=>sync(e.target.value));
num.addEventListener('input', e=>sync(e.target.value));
sync(41);
"""


def build():
    doc = json.loads(SRC.read_text())
    rows = compact(doc)
    flagged = doc["flaggedForTeacherReview"]
    n_wb = len({r["n"] for r in rows if r["wb"]})
    final = rows[-1]

    cards = ""
    for f in flagged:
        note = f["note"].replace("FLAGGED for teacher review.", "").strip()
        says = note.split("'")[1] if "'" in note else f["skill"]
        cards += f"""
        <div class="flagcard">
          <div class="hd"><span class="num">Lesson {f['lesson']}</span>
            <span class="says">your tool says &ldquo;{f['skill']}&rdquo;</span></div>
          <p>{note}</p>
        </div>"""

    page = f"""<title>Phonics Sound List &mdash; 128 Lessons</title>
<style>{CSS}</style>
<div class="wrap">

<header>
  <div class="eyebrow">Reading Foundations &middot; scope &amp; sequence</div>
  <h1>What a child can read, lesson by lesson</h1>
  <p class="lede">The rulebook behind every decodable passage. For each of the 128
  lessons it records exactly which letters, letter teams and heart words a reader
  has been taught by that point &mdash; so a story can be checked against it word
  by word instead of by eye.</p>
  <p class="lede"><strong>Lessons are cumulative.</strong> A child on Lesson 41
  has had 1 through 40.</p>

  <div class="stats">
    <div class="stat"><div class="v">128</div><div class="k">Lessons</div></div>
    <div class="stat"><div class="v">{len(final['allG'])}</div><div class="k">Sounds by the end</div></div>
    <div class="stat"><div class="v">{len(final['allH'])}</div><div class="k">Heart words</div></div>
    <div class="stat is-flag"><div class="v">{len(flagged)}</div><div class="k">Need your eye</div></div>
    <div class="stat is-wb"><div class="v">{n_wb}</div><div class="k">Need a word list</div></div>
  </div>
</header>

<section>
  <h2>Six places I had to guess</h2>
  <p class="sub">Your tool's curriculum says something here that looks like a typo.
  I made a call so the list could be built &mdash; but a wrong call puts a sound in
  front of a child before they have been taught it. These are the ones worth
  your time.</p>
  <div class="flags">{cards}</div>
</section>

<section>
  <h2>Check any lesson</h2>
  <p class="sub">Drag to a lesson to see everything a child can read by that point.</p>
  <div class="picker">
    <div class="pickrow">
      <label for="range">Lesson</label>
      <input type="range" id="range" min="1" max="128" value="41">
      <input type="number" id="num" min="1" max="128" value="41" aria-label="Lesson number">
    </div>
    <div class="picked" id="picked"></div>
  </div>
</section>

<section>
  <h2>All 128 lessons</h2>
  <p class="sub">What each lesson adds. <span class="tile v">a</span> vowels,
  <span class="tile c">m</span> consonants, <span class="tile w">&hearts; the</span>
  heart words. The bar shows how many sounds a reader has by then.</p>
  <div id="spine"></div>
</section>

<footer>
  Built from <code>sound-list.json</code>, which is generated from the phonics
  assessment tool's own curriculum &mdash; so lesson names and order cannot drift.
  Scope &amp; sequence follows UFLI Foundations; all passage text is original.
  Heart words are from the public-domain Dolch list (1936).
</footer>

</div>
<script>{JS.replace('__DATA__', json.dumps(rows, separators=(',', ':')))}</script>
"""
    OUT.write_text(page)
    print(f"wrote {OUT}  ({len(page):,} bytes)")
    print(f"  {len(flagged)} flagged, {n_wb} needing a word list")


if __name__ == "__main__":
    build()
