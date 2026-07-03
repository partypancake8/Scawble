// lexicon.js — the word source. Swappable by design (PRD §07): v1 ships the
// public-domain ENABLE list; a licensed list can drop in behind the same API.
// A DAWG is the eventual packed form; a Set is correct and fine to start.

/** @typedef {{isWord:(w:string)=>boolean, size:number, name:string}} Lexicon */

/** Build a lexicon from an iterable of words. Case-insensitive. */
export function makeLexicon(words, name = 'custom') {
  const set = new Set();
  for (const w of words) {
    const u = String(w).trim().toUpperCase();
    if (u) set.add(u);
  }
  return {
    name,
    size: set.size,
    isWord: (w) => set.has(String(w).toUpperCase()),
  };
}

/** Parse a newline-separated word list (e.g. enable1.txt) into a lexicon. */
export function loadFromText(text, name = 'ENABLE') {
  return makeLexicon(text.split(/\r?\n/), name);
}

// A tiny built-in list so the app runs before the full ENABLE file is wired in.
// Replace by loading enable1.txt (~172k words) at startup.
export const STARTER_WORDS = (
  'AA AB ABLE ACE ACT AD ADD AGE AGO AH AID AIM AIR ALE ALL AN AND ANT ANY ' +
  'APE APT ARC ARE ARM ART AS ASH ASK AT ATE AWE AX AYE BAD BAG BAN BAR BAT ' +
  'BE BED BEE BEG BET BID BIG BIN BIT BOA BOG BOO BOW BOX BOY BUD BUG BUN BUS ' +
  'BUT BUY BY CAB CAD CAN CAP CAR CAT COB COD COG CON COO COP COT COW COY CRY ' +
  'CUB CUD CUE CUP CUR CUT DAB DAD DAM DAY DEN DEW DID DIE DIG DIM DIN DIP DOE ' +
  'DOG DON DOT DRY DUB DUE DUG DUO DYE EAR EAT EBB EEL EGG EGO ELF ELK ELM END ' +
  'EON ERA ERE ERR EVE EWE EYE FAD FAN FAR FAT FED FEE FEW FIB FIG FIN FIR FIT ' +
  'FIX FLU FLY FOB FOE FOG FOP FOR FOX FRY FUN FUR GAB GAD GAG GAL GAP GAS GEL ' +
  'GEM GET GIG GIN GNU GOB GOD GOO GOT GUM GUN GUT GUY GYM HAD HAG HAM HAS HAT ' +
  'HAY HEM HEN HER HEW HEX HEY HID HIM HIP HIS HIT HOB HOE HOG HOP HOT HOW HUB ' +
  'HUE HUG HUM HUT ICE ICY IF ILK ILL IMP IN INK INN ION IRE IRK IS IT ITS IVY ' +
  'JAB JAG JAM JAR JAW JAY JET JIB JIG JOB JOG JOT JOY JUG JUT KEG KEN KEY KID ' +
  'KIN KIT LAB LAD LAG LAP LAW LAX LAY LEA LED LEG LEI LET LID LIE LIP LIT LOB ' +
  'LOG LOP LOT LOW LUG LYE MAD MAN MAP MAR MAT MAW MAY MEN MET MEW MID MIX MOB ' +
  'MOD MOM MOP MOW MUD MUG MUM NAB NAG NAP NAY NET NEW NIB NIL NIP NIT NOD NOR ' +
  'NOT NOW NUB NUN NUT OAF OAK OAR OAT ODD ODE OF OFF OFT OH OIL OLD ONE OP OR ' +
  'ORB ORE OUR OUT OVA OWE OWL OWN OX PAD PAL PAN PAP PAR PAT PAW PAY PEA PEG ' +
  'PEN PEP PER PET PEW PIE PIG PIN PIP PIT PLY POD POI POP POT POW PRO PRY PUB ' +
  'PUG PUN PUP PUS PUT RAG RAM RAN RAP RAT RAW RAY RED REF REV RIB RID RIG RIM ' +
  'RIP ROB ROD ROE ROT ROW RUB RUE RUG RUM RUN RUT RYE SAC SAD SAG SAP SAT SAW ' +
  'SAX SAY SEA SEE SET SEW SHE SHY SIN SIP SIR SIT SIX SKI SKY SLY SOB SOD SON ' +
  'SOP SOT SOW SOY SPA SPY STY SUB SUE SUM SUN SUP TAB TAD TAG TAN TAP TAR TAT ' +
  'TAX TEA TEE TEN THE THY TIC TIE TIN TIP TOE TON TOO TOP TOT TOW TOY TRY TUB ' +
  'TUG TUN TUT TWO UGH UP URN US USE VAN VAT VET VEX VIA VIE VIM VOW WAD WAG WAN ' +
  'WAR WAS WAX WAY WE WEB WED WEE WET WHO WHY WIG WIN WIT WOE WOK WON WOO WOW WRY ' +
  'WYE YAK YAM YAP YAW YEA YEN YES YET YEW YOU ZAG ZAP ZED ZEE ZIG ZIP ZIT ZOO ' +
  // a few longer ones for bingo/testing
  'QUIET QUART WORDS WORD PLAYS PLAY TILES TILE BOARD SCORE GAMES GAME ' +
  'FRIEND FRIENDS SCRAWL SCRAWLED HELLO WORLD ANTED ANTE OATEN'
).split(/\s+/);

/** Default lexicon (starter list). Swap for full ENABLE at load. */
export const starterLexicon = makeLexicon(STARTER_WORDS, 'STARTER');
