#!/usr/bin/env python3
"""A curated core vocabulary for decodable stories, K-2.

The system dictionary is 236,000 words of mostly obscure entries — it will
happily offer "wops" and "dyak" as Lesson 41 words. A decodable story needs the
opposite: a small, ordinary vocabulary a six-year-old actually has.

So this list is hand-authored. Every word is original selection from general
English; nothing is copied from any published program's word lists.

AMBIGUOUS is the other half of the job. Some spellings say two different things
(`ow` in snow vs cow, `ea` in eat vs head). Spelling alone cannot tell them
apart, which is why audit_passage.py records those as known limitations. Tagging
each word with which sound it uses is what resolves them.
"""

# ---------------------------------------------------------------------------
# Never put these in front of a child, however decodable they are. A first-grade
# practice sheet with "gun" on it generates a parent phone call, and the sheet is
# the last place anyone would think to look. Found by a writer agent that reached
# for them at Lesson 19.
# ---------------------------------------------------------------------------
BLOCKED = {
    "gun", "guns", "kill", "kills", "shot", "shoot", "gas", "bet", "bets",
    "mob", "cop", "cops", "nag", "nags", "dam", "ban", "bans", "suck", "sucks",
    "hell", "damn", "dumb", "stupid", "fat", "fatter", "fattest", "ugly",
    "dead", "die", "died", "kick", "kicks", "hit", "hits", "slap", "slaps",
    "gut", "rut", "pus", "bum", "butt", "junk", "drug", "drugs", "beer",
    "wine", "bar", "bars", "cash", "loss", "sin", "sins", "war",
}

# ---------------------------------------------------------------------------
# Words whose spelling is ambiguous: which sound does THIS word use, and from
# which lesson is it therefore safe? This is the data the auditor cannot infer.
# ---------------------------------------------------------------------------
AMBIGUOUS = {
    # ow saying long o (86) vs ow saying /ow/ (96)
    "snow": 86, "grow": 86, "low": 86, "slow": 86, "blow": 86, "show": 86,
    "know": 98, "throw": 86, "glow": 86, "flow": 86, "crow": 86, "bowl": 86,
    "own": 86, "yellow": 86, "window": 86, "pillow": 86, "shadow": 86,
    "cow": 96, "how": 96, "now": 96, "down": 96, "town": 96, "brown": 96,
    "clown": 96, "crown": 96, "owl": 96, "growl": 96, "howl": 96, "flower": 96,
    "power": 96, "tower": 96, "shower": 96, "crowd": 96, "frown": 96,

    # ea saying long e (85) vs short e (94) vs long a (114)
    "eat": 85, "sea": 85, "tea": 85, "read": 85, "meal": 85, "leaf": 85,
    "beach": 85, "clean": 85, "dream": 85, "team": 85, "seat": 85, "beak": 85,
    "heat": 85, "meat": 85, "neat": 85, "peach": 85, "reach": 85, "teach": 85,
    "bean": 85, "mean": 85, "east": 85, "least": 85, "speak": 85, "steam": 85,
    "head": 94, "bread": 94, "ready": 94, "heavy": 94, "feather": 94,
    "weather": 94, "sweat": 94, "thread": 94, "spread": 94, "meadow": 94,
    "great": 114, "break": 114, "steak": 114,

    # oo saying short oo (89) vs long oo (90)
    "book": 89, "look": 89, "took": 89, "good": 89, "foot": 89, "wood": 89,
    "hook": 89, "cook": 89, "hood": 89, "stood": 89, "shook": 89, "brook": 89,
    "moon": 90, "soon": 90, "food": 90, "room": 90, "pool": 90, "tool": 90,
    "boot": 90, "root": 90, "roof": 90, "spoon": 90, "broom": 90, "tooth": 90,
    "zoo": 90, "too": 90, "noon": 90, "cool": 90, "school": 90, "smooth": 90,

    # ou saying /ow/ (96) vs long u (115)
    "out": 96, "loud": 96, "cloud": 96, "found": 96, "round": 96, "sound": 96,
    "ground": 96, "mouth": 96, "south": 96, "count": 96, "house": 96,
    "mouse": 96, "shout": 96, "about": 96, "proud": 96, "our": 96,
    "soup": 115, "group": 115, "youth": 115,

    # ear saying /air/ (112) vs /er/ (113)
    "bear": 112, "pear": 112, "wear": 112, "tear": 112, "swear": 112,
    "hear": 113, "near": 113, "year": 113, "clear": 113, "dear": 113,
    "ear": 113, "fear": 113, "beard": 113, "spear": 113,

    # th voiced (46) vs unvoiced (47) — one lesson apart, low risk either way
    "this": 46, "that": 46, "then": 46, "them": 46, "there": 46, "they": 46,
    "thin": 47, "thick": 47, "thump": 47, "path": 47, "bath": 47, "math": 47,
    "moth": 47, "with": 47, "cloth": 47, "tooth": 47, "teeth": 47,

    # u_e saying /oo/ (58) vs /yoo/ (58, second sound)
    "tube": 58, "tune": 58, "rude": 58,
    "cube": 58, "cute": 58, "mule": 58, "huge": 61,
}

# ---------------------------------------------------------------------------
# Which words may take which endings. Without this the generator cheerfully
# produces "alled", "aboutly" and "ams" -- an inflection engine with no idea what
# a word IS. English needs a part of speech, and there is no tagger here, so the
# tagging is explicit and reviewable.
# ---------------------------------------------------------------------------
VERBS = set("""
sit run hop jump nap dig rub tap pat pack pick kick lick tick lock rock
help rest test list jump bump dump pump stamp camp
stop step stand stick spin spill slip slap snap swim grab grin grip trip
drip drop bend send lend mend land sand
bake make take wake rake shake name tame save wave date skate race place
bite shine dive drive ride slide smile hope vote hide
catch match fetch judge
call fall fill pull toss miss kiss pass yell tell sell smell spell
fish wish dish rush brush wash
melt felt hold fold told
paint plant point join boil spoil
play stay say pray sway
read eat clean dream reach teach speak
look cook shook cool
count shout
turn burn curl
start park bark mark
learn
""".split())

ADJECTIVES = set("""
big fat sad mad glad bad red hot wet dry
tall small long short thin thick quick slow fast
soft hard warm cold loud proud kind wild mild bold
clean neat sweet deep green bright light dark sharp smart
happy funny sunny lucky
smooth
""".split()) - {"fat"}

NOUNS_NO_PLURAL = set("""
mud sand water milk air fun help
""".split())

# Function words take no ending at all. Without this the bank offers "alls",
# "abouts" and "ams".
FUNCTION_WORDS = set("""
a an as at is in on of it up us am be he she we me my by if do to no so go or
the and but not can that this these those then them there they both just next
than when which more most very too out our all about off am was were has had
have some any each both her his him one two who why how what where
""".split())

# ---------------------------------------------------------------------------
# The core vocabulary. Grouped only to make it readable and reviewable by a
# teacher; the auditor decides which lesson each word belongs to.
# ---------------------------------------------------------------------------
CORE = """
# --- short a ---
at bat cat fat hat mat pat rat sat
am ham jam ram yam dam
an ban can fan man pan ran tan van
bad dad had lad mad pad sad
bag rag tag wag nag
cap gap lap map nap tap zap
as gas has
ax fax tax wax
# --- short i ---
it bit fit hit kit lit pit sit
in bin fin pin tin win
big dig fig pig wig jig rig
bid did hid kid lid rid
dip hip lip rip sip tip zip nip
him rim dim
fix mix six
is his
# --- short o ---
cot dot got hot lot not pot rot tot
cop hop mop pop top
bog dog fog hog jog log
cob job mob rob sob
cod nod pod rod
ox box fox
on
# --- short u ---
but cut hut nut rut
bug dug hug jug mug rug tug
bun fun gun run sun
cub hub rub tub
bud mud
gum hum sum
us bus
up cup pup
# --- short e ---
bet get jet let met net pet set vet wet yet
den hen men pen ten
bed fed led red wed
beg leg peg
gem hem
# --- workhorse words a story cannot do without ---
fast last past cast mast vast
went sent spent
just must dust rust crust trust
next text
than that then them this
both
no so go he she we me be
mine nine fine wine vine
bottom button kitten mitten
soft lost cost
help held melt felt belt built
milk silk self shelf film
# --- verbs and words that make stories move ---
sit sat run ran hop hopped jump nap naps naps
had has run runs sits gets rubs naps digs taps
# --- FLSZ and -all family (42-43) ---
off puff cuff huff muff
bell fell sell tell well yell fill hill mill pill will
bill dill gill kill
mess less kiss miss hiss boss loss toss fuss
buzz fizz jazz
all ball call fall hall mall tall wall small
doll roll toll
bull full pull
# --- ck (44) ---
back pack rack sack tack black
deck neck peck
kick lick pick sick tick brick stick trick
dock lock rock sock clock block
duck luck puck suck truck stuck
# --- digraphs (45-52) ---
ship shop shed shell shut shot fish dish wish cash dash rash
chin chip chop chum chest chill much such rich
when whip which
phone graph
king ring sing wing long song sang rang bang hang
bank tank sank rink sink pink wink junk trunk think thank
# --- blends (53+) ---
stop step stem stand stick still spot spin spill
slip slap slid sled snap snug stub swim swam
flag flat flip flop clap clip club crab crop crib
drip drop drum grab grin grip trip trap tree from
frog plan plum plus blob blot brag brim
bend send lend mend hand land sand band
best nest rest test vest west list fist mist
camp lamp jump bump dump lump pump ramp stamp
# --- VCe (54-62) ---
cake bake lake make take wake rake snake shake
came game name same tame flame frame
cave gave save wave brave
date gate late fate plate skate
face race place space
page cage rage stage
bike hike like bite kite site white
time lime dime nine line mine pine shine
dive five hive drive
ride side wide hide slide
smile mile pile while
bone cone stone phone home nose rose close those
hope rope note vote
hole mole pole whole
cute cube tube tune rude mule huge
# --- endings (63-76) ---
boxes dishes wishes foxes
jumped helped landed rested wanted
jumping helping resting sitting running hopping
catch match patch pitch ditch witch fetch
badge bridge judge fudge edge hedge
child mild wild find kind mind blind behind
cold gold hold told bold sold fold
most post host
colt bolt jolt
my by cry dry fly shy sky spy try why fry
baby happy funny sunny puppy penny lady city
apple little table candle handle bottle simple
# --- r-controlled (77-83) ---
car far jar star scar hard yard card farm arm barn
part start smart dark park shark sharp
for or born corn horn thorn short sport fort sort
more store score before shore
her herd fern
girl bird third shirt dirt first
turn burn hurt curl surf
# --- vowel teams (84-97) ---
rain train pain main chain plain paint
day play say way stay tray gray clay away today
see bee tree free three feet meet sweet green queen sleep keep deep
boat coat goat road toad soap load
toe hoe
pie tie lie die
night light right sight bright fight might high sigh
new few grew flew blew crew chew stew
fruit suit juice
blue true glue
saw paw jaw law claw draw straw
haul launch
caught taught daughter
boy toy joy soil coil boil spoil point join coin noise
"""


def word_list():
    """Every distinct word, lowercase, comment and blank lines dropped."""
    words = []
    for line in CORE.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        for w in line.split():
            w = w.lower()
            if w.isalpha() and w not in words:
                words.append(w)
    for w in AMBIGUOUS:
        if w not in words:
            words.append(w)
    return sorted(w for w in words if w not in BLOCKED)


if __name__ == "__main__":
    ws = word_list()
    print(f"{len(ws)} distinct words after blocking {len(BLOCKED)} unsuitable ones")
    print(f"{len(AMBIGUOUS)} carry an explicit sound tag")
    leaked = sorted(set(ws) & BLOCKED)
    print(f"blocked words that leaked through: {leaked or 'none'}")
