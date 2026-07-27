#!/usr/bin/env python3
"""scratch helper: wc.py N word word word -> which are usable"""
import json, sys, pathlib
import audit_passage as A
HERE = pathlib.Path(__file__).parent
n = int(sys.argv[1])
bank = set(json.loads((HERE/"word-bank.json").read_text())["availableByLesson"][str(n)])
sl = json.loads((HERE/"sound-list.json").read_text())["lessons"][n-1]
hearts = {w.lower() for w in sl["allowedHeartWords"]}
amb = {w["spelling"] for w in (sl.get("requiresWordBank") or [])}
ok, bad = [], []
for w in sys.argv[2:]:
    lw = w.lower()
    if lw in bank or lw in hearts:
        ok.append(w); continue
    risky = [r for r in amb if r in lw]
    if risky:
        bad.append(f"{w}(amb:{','.join(risky)})"); continue
    if A.audit(lw, n)["clean"]:
        ok.append(w)
    else:
        v = A.audit(lw, n)["violations"][0]
        bad.append(f"{w}({v['reason']})")
print("OK  :", " ".join(ok))
print("BAD :", " ".join(bad))
