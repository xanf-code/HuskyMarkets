// Pure content screening for market creation. Two tiers:
//   blocked — hard-block list (slurs); creation is rejected outright.
//   flagged — heuristic "possible targeting of an individual": a sensitive
//             verb co-occurring with two consecutive Capitalized words that
//             aren't a known campus place. Creation proceeds, but the market
//             is marked auto_flagged and auto-reported to the admin queue.

export interface ContentFlagResult {
  blocked: boolean;
  flagged: boolean;
}

// Moderation blocklist. Deliberately short and unambiguous; anything subtler
// goes through the flag-and-review path instead.
const HARD_BLOCK = /\b(?:nigger|faggot|retard(?:ed)?|tranny|kike|chink|spic)\b/i;

const SENSITIVE_VERBS: readonly RegExp[] = [
  /\bhook(?:s|ed|ing)?\s+up\b/i,
  /\bdat(?:e|es|ed|ing)\b/i,
  /\bdump(?:s|ed|ing)?\b/i,
  /\bcheat(?:s|ed|ing)?\b/i,
  /\bexpel(?:s|led|ling)?\b/i,
  /\bexpulsion\b/i,
  /\bpregnan(?:t|cy)\b/i,
  /\bsle(?:ep|pt)\s+with\b/i,
  /\barrest(?:s|ed|ing)?\b/i,
  /\bfired\b/i,
  /\bdrop(?:s|ped|ping)?\s+out\b/i,
  /\bbr(?:eak|oke)\s+up\b/i,
  /\boverdos(?:e|ed|ing)\b/i,
];

// Words that legitimately appear Capitalized mid-sentence on this campus —
// places, transit, seasons — plus sentence-leading question words. A
// capitalized pair is only treated as a person's name if *both* words
// survive this list.
const CAMPUS_ALLOWLIST = new Set(
  [
    "Northeastern", "Husky", "Huskies", "Boston", "Snell", "Library",
    "Curry", "Student", "Center", "Marino", "Matthews", "Arena",
    "Krentzman", "Quad", "Centennial", "Common", "Commons", "Village",
    "West", "East", "North", "South", "International", "Hall", "Dining",
    "Green", "Orange", "Red", "Blue", "Line", "Ruggles", "Copley",
    "Fenway", "Symphony", "Huntington", "Columbus", "Avenue", "Ave",
    "Street", "Mass", "Newbury", "Charles", "River", "Esplanade",
    "Spring", "Summer", "Fall", "Winter", "Thanksgiving", "Break",
    "Commencement", "Orientation", "Homecoming", "Springfest",
    "Will", "Does", "Do", "Is", "Are", "Can", "Could", "Should", "Would",
    "Who", "What", "When", "Where", "Why", "How", "If", "The", "A", "An",
    "Everyone", "Anyone", "Someone", "Nobody", "Resolves", "Yes", "No",
  ].map((w) => w.toLowerCase()),
);

function hasPersonName(text: string): boolean {
  // Maximal runs of space-separated Capitalized words; a run contains a
  // person-name candidate if two consecutive words both miss the allowlist.
  const runs = text.match(/(?:[A-Z][a-z]+ )+[A-Z][a-z]+/g) ?? [];
  return runs.some((run) => {
    const words = run.split(" ");
    for (let i = 0; i < words.length - 1; i += 1) {
      if (
        !CAMPUS_ALLOWLIST.has(words[i].toLowerCase()) &&
        !CAMPUS_ALLOWLIST.has(words[i + 1].toLowerCase())
      ) {
        return true;
      }
    }
    return false;
  });
}

export function flagContent(
  title: string,
  description: string,
  criteria: string,
): ContentFlagResult {
  const text = [title, description, criteria].join("\n");

  if (HARD_BLOCK.test(text)) {
    return { blocked: true, flagged: true };
  }

  const sensitive = SENSITIVE_VERBS.some((re) => re.test(text));
  return { blocked: false, flagged: sensitive && hasPersonName(text) };
}
