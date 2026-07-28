#!/usr/bin/env python3
"""A prop box: simple line-art shapes a scene can be composed from.

Drawn in code rather than generated as images, for four reasons that all still
hold: it costs nothing, the style stays identical across 128 sheets, it prints
clean on a cheap home printer, and there is no copyright question.

Each prop draws inside a 100x100 box with its feet on y=100, so the composer can
place them along a ground line without knowing anything about their shape.
"""

import re

STROKE = 'fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"'
WHITE = '#fff'

PROPS = {
    "sun": ('<circle cx="50" cy="34" r="20"/>'
            '<line x1="50" y1="4" x2="50" y2="-4"/><line x1="50" y1="72" x2="50" y2="64"/>'
            '<line x1="20" y1="34" x2="12" y2="34"/><line x1="88" y1="34" x2="80" y2="34"/>'
            '<line x1="28" y1="12" x2="23" y2="7"/><line x1="72" y1="56" x2="77" y2="61"/>'
            '<line x1="72" y1="12" x2="77" y2="7"/><line x1="28" y1="56" x2="23" y2="61"/>'),
    "tree": ('<path d="M50 96 L50 62"/>'
             '<path d="M50 8 C22 30 26 58 50 60 C74 58 78 30 50 8 z" fill="#fff"/>'),
    "house": ('<path d="M18 96 L18 52 L50 26 L82 52 L82 96 z" fill="#fff"/>'
              '<path d="M40 96 L40 68 L60 68 L60 96"/>'
              '<rect x="26" y="58" width="12" height="12" fill="#fff"/>'),
    "dog": ('<ellipse cx="44" cy="66" rx="28" ry="17" fill="#fff"/>'
            '<circle cx="76" cy="54" r="14" fill="#fff"/>'
            '<path d="M68 42 L64 26 L78 34 z" fill="#fff"/>'
            '<circle cx="80" cy="52" r="2" fill="#1a1a1a"/><circle cx="88" cy="56" r="3" fill="#1a1a1a"/>'
            '<line x1="28" y1="82" x2="28" y2="96"/><line x1="44" y1="83" x2="44" y2="96"/>'
            '<line x1="60" y1="83" x2="60" y2="96"/>'
            '<path d="M16 60 q-8 -10 2 -14"/>'),
    "cat": ('<ellipse cx="46" cy="68" rx="26" ry="15" fill="#fff"/>'
            '<circle cx="74" cy="54" r="13" fill="#fff"/>'
            '<path d="M64 44 L62 30 L74 40 z" fill="#fff"/><path d="M84 44 L88 30 L90 44 z" fill="#fff"/>'
            '<circle cx="70" cy="53" r="2" fill="#1a1a1a"/><circle cx="80" cy="53" r="2" fill="#1a1a1a"/>'
            '<line x1="30" y1="82" x2="30" y2="96"/><line x1="46" y1="83" x2="46" y2="96"/>'
            '<line x1="62" y1="83" x2="62" y2="96"/>'
            '<path d="M20 62 q-12 -14 -2 -22"/>'),
    "pig": ('<ellipse cx="44" cy="66" rx="28" ry="18" fill="#fff"/>'
            '<circle cx="76" cy="58" r="15" fill="#fff"/>'
            '<path d="M66 44 L62 30 L76 37 z" fill="#fff"/><path d="M84 44 L90 32 L92 46 z" fill="#fff"/>'
            '<ellipse cx="90" cy="62" rx="7" ry="5" fill="#fff"/>'
            '<circle cx="76" cy="54" r="2" fill="#1a1a1a"/>'
            '<line x1="28" y1="83" x2="28" y2="96"/><line x1="44" y1="84" x2="44" y2="96"/>'
            '<line x1="60" y1="84" x2="60" y2="96"/>'
            '<path d="M16 58 q-9 -4 -6 4 q3 7 9 2"/>'),
    "bird": ('<ellipse cx="48" cy="62" rx="22" ry="16" fill="#fff"/>'
             '<circle cx="72" cy="46" r="11" fill="#fff"/>'
             '<path d="M82 44 L94 48 L82 52 z" fill="#fff"/>'
             '<circle cx="74" cy="43" r="2" fill="#1a1a1a"/>'
             '<path d="M40 58 q12 -10 24 -2 q-12 12 -24 2 z" fill="#fff"/>'
             '<line x1="42" y1="78" x2="42" y2="96"/><line x1="56" y1="78" x2="56" y2="96"/>'),
    "fish": ('<path d="M22 60 C38 40 70 40 84 60 C70 80 38 80 22 60 z" fill="#fff"/>'
             '<path d="M22 60 L6 46 L10 60 L6 74 z" fill="#fff"/>'
             '<circle cx="72" cy="55" r="2.5" fill="#1a1a1a"/>'),
    "frog": ('<ellipse cx="50" cy="70" rx="28" ry="20" fill="#fff"/>'
             '<circle cx="36" cy="46" r="10" fill="#fff"/><circle cx="64" cy="46" r="10" fill="#fff"/>'
             '<circle cx="36" cy="46" r="3" fill="#1a1a1a"/><circle cx="64" cy="46" r="3" fill="#1a1a1a"/>'
             '<path d="M36 76 q14 10 28 0"/>'
             '<path d="M22 84 q-10 6 -4 12"/><path d="M78 84 q10 6 4 12"/>'),
    "bug": ('<ellipse cx="50" cy="66" rx="22" ry="26" fill="#fff"/>'
            '<line x1="50" y1="40" x2="50" y2="92"/>'
            '<circle cx="50" cy="36" r="10" fill="#fff"/>'
            '<path d="M44 27 L38 16"/><path d="M56 27 L62 16"/>'
            '<line x1="28" y1="56" x2="14" y2="48"/><line x1="72" y1="56" x2="86" y2="48"/>'
            '<line x1="28" y1="70" x2="14" y2="70"/><line x1="72" y1="70" x2="86" y2="70"/>'),
    "cup": ('<path d="M28 46 L34 92 L66 92 L72 46 z" fill="#fff"/>'
            '<line x1="28" y1="46" x2="72" y2="46"/>'
            '<path d="M72 56 q14 4 10 16 q-3 10 -14 8"/>'),
    "box": ('<path d="M24 50 L76 50 L76 92 L24 92 z" fill="#fff"/>'
            '<path d="M24 50 L36 38 L88 38 L76 50"/><path d="M88 38 L88 80 L76 92"/>'),
    "bed": ('<path d="M14 92 L14 58 L30 58 L30 74 L86 74 L86 92" fill="#fff"/>'
            '<path d="M30 74 L30 66 L70 66 L70 74" fill="#fff"/>'
            '<line x1="14" y1="82" x2="86" y2="82"/>'),
    "ball": ('<circle cx="50" cy="66" r="28" fill="#fff"/>'
             '<path d="M22 66 q28 -18 56 0"/><path d="M22 66 q28 18 56 0"/>'
             '<line x1="50" y1="38" x2="50" y2="94"/>'),
    "hat": ('<path d="M30 74 L36 40 L64 40 L70 74 z" fill="#fff"/>'
            '<line x1="16" y1="74" x2="84" y2="74"/>'
            '<line x1="34" y1="56" x2="66" y2="56"/>'),
    "star": ('<path d="M50 24 L59 52 L88 52 L64 69 L73 96 L50 79 L27 96 L36 69 L12 52 L41 52 z" fill="#fff"/>'),
    "flower": ('<line x1="50" y1="96" x2="50" y2="52"/>'
               '<circle cx="50" cy="38" r="10" fill="#fff"/>'
               '<circle cx="50" cy="20" r="9" fill="#fff"/><circle cx="50" cy="56" r="9" fill="#fff"/>'
               '<circle cx="32" cy="38" r="9" fill="#fff"/><circle cx="68" cy="38" r="9" fill="#fff"/>'
               '<path d="M50 72 q14 -8 20 2 q-14 8 -20 -2 z" fill="#fff"/>'),
    "rock": ('<path d="M16 92 q4 -26 24 -30 q22 -12 34 8 q16 6 10 22 z" fill="#fff"/>'),
    "puddle": ('<path d="M6 92 q6 -22 30 -24 q22 -12 46 -2 q16 2 12 26 z" fill="#e6e0d6"/>'
               '<path d="M26 80 q12 -6 22 -2" stroke-width="2"/>'
               '<path d="M56 74 q12 -5 22 -1" stroke-width="2"/>'),
    "kid": ('<circle cx="50" cy="26" r="16" fill="#fff"/>'
            '<circle cx="44" cy="24" r="2.5" fill="#1a1a1a"/><circle cx="56" cy="24" r="2.5" fill="#1a1a1a"/>'
            '<path d="M43 32 q7 6 14 0"/>'
            '<path d="M36 12 q6 -8 14 -5 q10 -5 14 5"/>'
            '<path d="M50 42 L50 70"/><path d="M50 70 L38 96"/><path d="M50 70 L62 96"/>'
            '<path d="M50 50 L32 62"/><path d="M50 50 L68 62"/>'),
    "sled": ('<path d="M12 74 L78 74 q14 0 14 10 L20 84 z" fill="#fff"/>'
             '<path d="M12 88 L92 88"/>'
             '<line x1="24" y1="84" x2="24" y2="88"/><line x1="64" y1="84" x2="64" y2="88"/>'
             '<path d="M92 88 q10 0 8 -8"/>'),
    "hill": ('<path d="M2 96 q26 -50 50 -50 q26 0 46 50 z" fill="#fff"/>'),
    "mat": ('<path d="M6 78 L74 78 L94 94 L26 94 z" fill="#fff"/>'
            '<path d="M20 82 L82 82" stroke-width="1.6"/>'
            '<path d="M14 88 L76 88" stroke-width="1.6"/>'),
    "hut": ('<path d="M50 10 L8 94 L92 94 z" fill="#fff"/>'
            '<path d="M50 10 L50 94" stroke-width="1.6"/>'
            '<path d="M34 94 L50 56 L66 94" fill="#fff"/>'),
    "pot": ('<path d="M20 48 L26 88 L74 88 L80 48 z" fill="#fff"/>'
            '<line x1="14" y1="48" x2="86" y2="48"/>'
            '<path d="M40 40 q10 -10 20 0" stroke-width="2"/>'),
    "bag": ('<path d="M24 44 L76 44 L82 92 L18 92 z" fill="#fff"/>'
            '<path d="M38 44 q12 -20 24 0" stroke-width="2"/>'),
    "book": ('<path d="M50 46 L14 54 L14 90 L50 82 z" fill="#fff"/>'
             '<path d="M50 46 L86 54 L86 90 L50 82 z" fill="#fff"/>'
             '<line x1="50" y1="46" x2="50" y2="82"/>'),
    "log": ('<path d="M14 62 L80 62 q12 14 0 28 L14 90 z" fill="#fff"/>'
            '<ellipse cx="14" cy="76" rx="9" ry="14" fill="#fff"/>'
            '<ellipse cx="14" cy="76" rx="4" ry="6"/>'),
}

# Which story words summon which prop. Plurals and simple inflections included
# because the writer will use them.
TRIGGERS = {
    "sun": ["sun"], "tree": ["tree", "trees"], "house": ["house", "home"],
    "dog": ["dog", "dogs", "pup", "pups", "puppy"],
    "cat": ["cat", "cats", "kitten"],
    "pig": ["pig", "pigs", "hog"],
    "bird": ["bird", "birds", "hen", "hens", "duck", "ducks"],
    "fish": ["fish"], "frog": ["frog", "frogs", "toad"],
    "bug": ["bug", "bugs", "ant", "ants"],
    "cup": ["cup", "cups", "mug", "mugs"],
    "box": ["box", "boxes"],
    "bed": ["bed", "beds"],
    "ball": ["ball", "balls"], "hat": ["hat", "hats", "cap", "caps"],
    "star": ["star", "stars"], "flower": ["flower", "flowers", "plant"],
    "rock": ["rock", "rocks"], "log": ["log", "logs"],
    "mat": ["mat", "mats", "rug", "rugs"],
    "hut": ["hut", "huts", "tent", "tents", "den"],
    "pot": ["pot", "pots", "pan", "pans"],
    "bag": ["bag", "bags", "sack", "sacks"],
    "book": ["book", "books"],
    "puddle": ["mud", "pond", "puddle", "water", "lake"],
    "kid": ["kid", "kids", "girl", "boy", "child", "sam", "tim", "pam", "dan",
            "meg", "nick", "ben", "tom", "jen", "max", "kit", "pat"],
    "sled": ["sled", "sleds", "cart", "wagon"],
    "hill": ["hill", "hills", "mountain"],
}


SENTENCE_END = ".!?\""


def find_names(text):
    """Character names: capitalised words that are not sentence openers."""
    tokens = re.findall(r"[A-Za-z']+|[.!?]", text)
    names, opener = [], True
    for t in tokens:
        if t in ".!?":
            opener = True
            continue
        if not opener and t[:1].isupper() and t.lower() not in COMMON_CAPS:
            if t not in names:
                names.append(t)
        opener = False
    # a name used only as a sentence opener still counts if it never appears
    # lowercase anywhere
    lowered = {w.lower() for w in re.findall(r"[a-z']+", text)}
    for t in re.findall(r"\b[A-Z][a-z]+\b", text):
        if t.lower() not in lowered and t.lower() not in COMMON_CAPS and t not in names:
            names.append(t)
    return names


COMMON_CAPS = {"i", "the", "a", "an", "it", "he", "she", "we", "they", "but",
               "then", "do", "is", "in", "on", "at", "and", "so", "no", "not",
               "can", "did", "was", "what", "who", "you", "your", "my", "this",
               "that", "there", "here", "look", "see", "said", "tap", "pat",
               "sit", "stop", "go", "get", "put", "come", "mom", "dad", "gran"}


def choose(story_words, limit=3):
    """Pick props the story actually mentions, in order of first mention."""
    lowered = [w.lower().strip(".,!?") for w in story_words]
    seen, chosen = set(), []
    for w in lowered:
        for prop, triggers in TRIGGERS.items():
            if prop in seen:
                continue
            if w in triggers:
                chosen.append(prop)
                seen.add(prop)
    return chosen[:limit]


def scene(story_words, width=660, height=250, text=None):
    """Compose a scene, or return None when nothing in the story can be drawn.

    Returning None matters: a wrong picture is worse than no picture, and the
    sheet has a "draw it yourself" fallback for exactly this case.
    """
    text = text or " ".join(story_words)
    people = find_names(text)[:2]
    props = choose(story_words)
    if not props and not people:
        return None

    ground = height - 34
    parts = [f'<line x1="18" y1="{ground}" x2="{width - 18}" y2="{ground}"/>']

    # sun always sits top-right and out of the lineup
    ground_props = [p for p in props if p != "sun"]
    # a figure for each named child, drawn first so they lead the scene
    items = ["kid"] * len(people) + ground_props
    ground_props = items[:4]
    if "sun" in props:
        parts.append(f'<g transform="translate({width - 116},8) scale(0.78)">{PROPS["sun"]}</g>')

    if ground_props:
        span = width - 150
        step = span / len(ground_props)
        for i, prop in enumerate(ground_props):
            size = 118 if len(ground_props) == 1 else 104
            x = 70 + step * i + (step - size) / 2
            y = ground - size
            parts.append(f'<g transform="translate({x:.0f},{y:.0f}) scale({size / 100:.2f})">'
                         f'{PROPS[prop]}</g>')

    # a little grass so the ground line is not bare
    parts.append(f'<path d="M50 {ground} l-4 -12 M56 {ground} l2 -14 M62 {ground} l6 -11" '
                 f'stroke-width="2"/>')
    parts.append(f'<path d="M{width - 70} {ground} l-4 -12 M{width - 62} {ground} l2 -13" '
                 f'stroke-width="2"/>')

    body = "".join(parts)
    label = ", ".join((["a child"] * len(people)) + [p for p in props if p != "sun"])
    return (f'<svg viewBox="0 0 {width} {height}" role="img" '
            f'aria-label="A simple line drawing of: {label}.">'
            f'<g {STROKE}>{body}</g></svg>')


if __name__ == "__main__":
    print(f"{len(PROPS)} props: {', '.join(sorted(PROPS))}")
    demo = "The pig sat on a log in the sun".split()
    print(f"\nprops chosen for {demo!r}: {choose(demo)}")
