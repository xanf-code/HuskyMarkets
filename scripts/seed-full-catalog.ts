#!/usr/bin/env node
/**
 * Full HuskyMarkets demo catalog seed (reusable).
 *
 * - Creates Spring 2026 semester + keeps Summer (current) / Fall
 * - ~42 authentic NU 2026 markets across all categories
 * - 8 creators + 150 predictors (*.seed@northeastern.edu only)
 * - Dense historic bets with staggered timestamps for organic charts
 * - Resolves Spring markets → snapshot Hall of Fame (Spring only)
 * - Grants admin to aswathappa.d@northeastern.edu if that profile exists
 * - Never places bets / creates markets as the admin email
 *
 * Usage:
 *   SEED_ENV=dev npx tsx --env-file=.env.local scripts/seed-full-catalog.ts
 *   SKIP_WIPE=1 SKIP_EXISTING=1 SEED_CATEGORIES=sports,academics,wildcard \
 *     SEED_PER_CATEGORY=3 SEED_ENV=dev npx tsx --env-file=.env.local scripts/seed-full-catalog.ts
 */
if (process.env.SEED_ENV !== "dev") {
  console.error("Refusing to seed: set SEED_ENV=dev (non-prod only).");
  process.exit(1);
}

import { CAP_PER_MARKET } from "../src/lib/constants";
import {
  densifyPriceHistory,
  impliedFromPools,
  replayPriceHistory,
} from "../src/lib/seed-plan";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BASE = `${SUPABASE_URL}/rest/v1`;
const AUTH = `${SUPABASE_URL}/auth/v1`;
const SR = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
} as const;

const ADMIN_EMAIL = "aswathappa.d@northeastern.edu";
const SEED_PASSWORD = "HuskyM4rkets!Seed2026";
const PREDICTOR_COUNT = 150;
const CREATOR_COUNT = 8;
const MIN_PREDICTORS_RESOLVED = 120;
const MIN_PREDICTORS_OPEN = 55;
const DAY = 24 * 3600 * 1000;

type Category =
  | "campus"
  | "transit"
  | "weather"
  | "sports"
  | "academics"
  | "dining"
  | "wildcard";

type Bucket = "spring" | "summer" | "fall";

interface CatalogMarket {
  bucket: Bucket;
  category: Category;
  title: string;
  description: string;
  resolution_criteria: string;
  outcomes: string[];
  /** Index of winning outcome when bucket === spring */
  winIdx?: number;
}

// ── Final approved catalog ───────────────────────────────────────────────────

const CATALOG: CatalogMarket[] = [
  // Campus
  {
    bucket: "spring",
    category: "campus",
    title: "Which spring campus headache dominated Sidechat the most?",
    description:
      "Spring 2026 Sidechat chatter: housing, dining, NU Alert timing, or construction.",
    resolution_criteria:
      "Resolves to the theme that The Huntington News or campus discourse most frequently attributed to Sidechat in spring 2026; otherwise None of the above.",
    outcomes: [
      "Housing waitlists",
      "Dining quality",
      "NU Alert timing",
      "Construction noise",
      "None of the above",
    ],
    winIdx: 2,
  },
  {
    bucket: "spring",
    category: "campus",
    title: "Did Northeastern announce extended Snell hours for spring finals?",
    description: "Snell Library finals-week hours announcement for spring 2026.",
    resolution_criteria:
      "Resolves YES if library.northeastern.edu or an official NU notice announced extended Snell hours for spring 2026 finals.",
    outcomes: ["Yes", "No"],
    winIdx: 0,
  },
  {
    bucket: "summer",
    category: "campus",
    title:
      "Will NGN publish a Unity Cup follow-up before the Aug 8 championship?",
    description:
      "Boston Unity Cup runs on NU fields through early August 2026; NGN covered the kickoff.",
    resolution_criteria:
      "Resolves YES if news.northeastern.edu publishes another Unity Cup story dated before Aug 8, 2026 championship day.",
    outcomes: ["Yes", "No"],
  },
  {
    bucket: "fall",
    category: "campus",
    title: "When will Fall 2026 Convocation details be posted publicly?",
    description: "Date + indoor/outdoor venue for Fall Convocation.",
    resolution_criteria:
      "Resolves by the first date news.northeastern.edu or calendar.northeastern.edu posts both date and venue (indoor/outdoor) for Fall 2026 Convocation.",
    outcomes: [
      "Before Aug 15",
      "Aug 15–31",
      "Sep 1–7",
      "Not posted by Sep 8",
    ],
  },
  {
    bucket: "fall",
    category: "campus",
    title: "Will Fall 2026 Convocation be held outdoors on Centennial Common?",
    description: "Outdoor vs indoor Convocation for Fall 2026.",
    resolution_criteria:
      "Resolves YES if official NU communications state Convocation is outdoors on Centennial Common.",
    outcomes: ["Yes", "No"],
  },
  {
    bucket: "fall",
    category: "campus",
    title: "Which building gets the next major renovation headline before Oct 1?",
    description: "Campus renovation announcement watch through early Fall.",
    resolution_criteria:
      "Resolves to the building named in the first official NU renovation announcement dated before Oct 1, 2026; else None of the above.",
    outcomes: ["Shillman", "Snell", "ISEC", "Cabot", "None of the above"],
  },

  // Transit
  {
    bucket: "spring",
    category: "transit",
    title: "What was the biggest Ruggles pain point in spring 2026?",
    description:
      "Columbus Ave entrance closed Feb 9, 2026 for Phase II work through ~2028.",
    resolution_criteria:
      "Resolves to the issue most cited in Huntington News / official MBTA NU-area notices for spring 2026; else None of the above.",
    outcomes: [
      "Columbus Ave closed",
      "Fare gate queues",
      "Orange Line delays",
      "Forsyth crowding",
      "None of the above",
    ],
    winIdx: 0,
  },
  {
    bucket: "spring",
    category: "transit",
    title: "Did MBTA finish any Ruggles Phase II milestone before May 1?",
    description: "Ruggles Phase II accessibility/renovation milestones.",
    resolution_criteria:
      "Resolves YES if MBTA or NU published a Phase II milestone completion notice dated before May 1, 2026.",
    outcomes: ["Yes", "No"],
    winIdx: 1,
  },
  {
    bucket: "summer",
    category: "transit",
    title: "Will Green Line E still list Northeastern as open on Aug 31?",
    description:
      "NU’s Green Line E stop during/after the Aug Orange Line shutdown window.",
    resolution_criteria:
      "Resolves from mbta.com station status for Northeastern University on Aug 31, 2026.",
    outcomes: [
      "Yes, open",
      "Temporarily bypassed",
      "Listed closed",
      "Can't tell on mbta.com",
    ],
  },
  {
    bucket: "summer",
    category: "transit",
    title: "Will Orange Line fully resume Aug 31 after the Oak Grove shutdown?",
    description:
      "MBTA suspended Orange Line Oak Grove↔Back Bay Aug 20–30, 2026.",
    resolution_criteria:
      "Resolves YES if mbta.com shows normal Orange Line service restored on Aug 31, 2026 without extension of that shutdown.",
    outcomes: ["Yes", "No"],
  },
  {
    bucket: "fall",
    category: "transit",
    title: "What's the #1 NU-area transit complaint in the first two Fall weeks?",
    description: "First two weeks of Fall 2026 classes near Ruggles / Symphony / Orange.",
    resolution_criteria:
      "Resolves to the theme most covered by Huntington News or official NU transit advisories Sep 9–23, 2026.",
    outcomes: [
      "Ruggles Columbus closed",
      "Symphony still bypassed",
      "Orange Line reliability",
      "Huntington bus bunching",
    ],
  },
  {
    bucket: "fall",
    category: "transit",
    title: "Will Ruggles Columbus Ave entrance still be closed on Sep 9?",
    description: "First day of Fall 2026 classes; Columbus entrance closed since Feb 2026.",
    resolution_criteria:
      "Resolves YES if MBTA still lists Columbus Ave entrance closed on Sep 9, 2026.",
    outcomes: ["Yes", "No"],
  },

  // Weather
  {
    bucket: "spring",
    category: "weather",
    title: "How many Nor'easters delayed NU morning classes in spring 2026?",
    description: "Storm-related morning class delays spring semester.",
    resolution_criteria:
      "Resolves by count of official NU weather delay/cancellation notices for morning classes during spring 2026 Nor'easters.",
    outcomes: ["0", "1", "2", "3+"],
    winIdx: 1,
  },
  {
    bucket: "spring",
    category: "weather",
    title: "Did Boston see measurable snow after March 15, 2026?",
    description: "Late-season Boston snow.",
    resolution_criteria:
      "Resolves YES if NWS/Boston weather records show ≥0.1\" snow at Boston after March 15, 2026.",
    outcomes: ["Yes", "No"],
    winIdx: 1,
  },
  {
    bucket: "summer",
    category: "weather",
    title: "How many 90°F+ days will Boston log in August 2026?",
    description: "August heat in Boston.",
    resolution_criteria:
      "Resolves by NWS official count of days with max temp ≥90°F at Boston in August 2026.",
    outcomes: ["0–2", "3–5", "6–8", "9+"],
  },
  {
    bucket: "summer",
    category: "weather",
    title: "Will Boston hit ≥95°F any day through Aug 9 (summer classes end)?",
    description: "Late-summer heat during final summer class weeks.",
    resolution_criteria:
      "Resolves YES if Boston official high reaches ≥95°F on any day from now through Aug 9, 2026.",
    outcomes: ["Yes", "No"],
  },
  {
    bucket: "fall",
    category: "weather",
    title: "What's the weather story of Labor Day move-in weekend (Sep 4–7)?",
    description: "Boston move-in weekend weather.",
    resolution_criteria:
      "Resolves from NWS daily observations Sep 4–7, 2026 for Boston.",
    outcomes: [
      "All dry",
      "One rainy day",
      "Two+ rainy days",
      "Heat advisory",
    ],
  },
  {
    bucket: "fall",
    category: "weather",
    title: "Will Boston's first hard frost arrive before Nov 1, 2026?",
    description: "First fall hard frost timing.",
    resolution_criteria:
      "Resolves YES if Boston records a hard frost (≤28°F) before Nov 1, 2026 per NWS.",
    outcomes: ["Yes", "No"],
  },

  // Sports
  {
    bucket: "spring",
    category: "sports",
    title: "Which spring Husky storyline got the most Huntington News ink?",
    description: "Spring 2026 athletics coverage.",
    resolution_criteria:
      "Resolves to the theme with the most distinct Huntington News athletics stories in spring 2026; else None of the above.",
    outcomes: [
      "Men's hockey vs BC",
      "CAA tournament run",
      "Recruiting news",
      "Coaching chatter",
      "None of the above",
    ],
    winIdx: 0,
  },
  {
    bucket: "spring",
    category: "sports",
    title: "Did NU men's hockey take at least one win in the BC home-and-home?",
    description: "Spring 2026 Beanpot-rivalry series vs Boston College.",
    resolution_criteria:
      "Resolves YES if Northeastern men's hockey recorded ≥1 win against BC in the spring 2026 home-and-home per nuhuskies.com.",
    outcomes: ["Yes", "No"],
    winIdx: 0,
  },
  {
    bucket: "summer",
    category: "sports",
    title: "Where is Boston Unity Cup's championship game played (by Aug 8)?",
    description: "Unity Cup title sponsor NU; games at Carter Playground fields.",
    resolution_criteria:
      "Resolves by the published championship venue on or before Aug 8, 2026.",
    outcomes: [
      "Carter Playground",
      "Another NU field",
      "Off campus",
      "Cancelled/postponed",
    ],
  },
  {
    bucket: "summer",
    category: "sports",
    title: "Will women's soccer earn a result in the Aug 13 road opener at BU?",
    description: "NU women's soccer opens at Boston University Aug 13, 2026.",
    resolution_criteria:
      "Resolves YES if the match is a win or draw for Northeastern per nuhuskies.com box score.",
    outcomes: ["Yes", "No"],
  },
  {
    bucket: "fall",
    category: "sports",
    title: "Who wins NU's home volleyball weekend vs HC / Fairfield / Harvard?",
    description: "Cabot Center tournament Sep 4–6, 2026.",
    resolution_criteria:
      "Resolves by NU's match record across the three home tournament matches per nuhuskies.com.",
    outcomes: ["Sweep 3–0", "Win 2 of 3", "Win 1 of 3", "Win 0 of 3"],
  },
  {
    bucket: "fall",
    category: "sports",
    title: "Which team books a CAA tournament berth first in Fall 2026?",
    description: "Men's soccer, women's soccer, or volleyball.",
    resolution_criteria:
      "Resolves to the first of the three programs to clinch a CAA tournament berth before Nov 1; else None before Nov 1.",
    outcomes: [
      "Men's Soccer",
      "Women's Soccer",
      "Volleyball",
      "None before Nov 1",
    ],
  },

  // Academics
  {
    bucket: "spring",
    category: "academics",
    title: "What dominated co-op Sidechat anxiety in spring 2026?",
    description: "Co-op search stress themes.",
    resolution_criteria:
      "Resolves to the theme most referenced in Huntington News co-op coverage or widely cited campus discussion in spring 2026; else None of the above.",
    outcomes: [
      "NUworks ghosting",
      "Interview scheduling",
      "Offer timing",
      "Housing on co-op",
      "None of the above",
    ],
    winIdx: 0,
  },
  {
    bucket: "spring",
    category: "academics",
    title: "Did spring add/drop close without a registrar extension?",
    description: "Spring 2026 add/drop calendar integrity.",
    resolution_criteria:
      "Resolves YES if the registrar did not publish an extension past the posted spring add/drop deadline.",
    outcomes: ["Yes", "No"],
    winIdx: 0,
  },
  {
    bucket: "summer",
    category: "academics",
    title: "Which Jul 24 GSE Human+AI ISEC block feels most packed?",
    description: "GSE Human + AI event at ISEC Jul 24, 2026 (panel / networking / reception).",
    resolution_criteria:
      "Resolves by official event photos/recap or organizer statement indicating the fullest block; if unclear, Equal across all.",
    outcomes: [
      "Panel discussion",
      "Networking conversations",
      "Reception",
      "Equal across all",
    ],
  },
  {
    bucket: "summer",
    category: "academics",
    title: "Will COE list another Galante info session after Jul 28 before Aug 15?",
    description: "Repeating Galante Engineering Business certificate info sessions.",
    resolution_criteria:
      "Resolves YES if coe.northeastern.edu lists a Galante info session dated after Jul 28 and before Aug 15, 2026.",
    outcomes: ["Yes", "No"],
  },
  {
    bucket: "fall",
    category: "academics",
    title: "Will Talent Connect Fall day themes stay unchanged through Oct 1?",
    description:
      "Oct 14 Business/Creative/Social Impact; Oct 15 STEM & Sustainability; Oct 16 Virtual.",
    resolution_criteria:
      "Resolves from careers.northeastern.edu Talent Connect page as of Oct 1, 2026.",
    outcomes: [
      "All three unchanged",
      "One day renamed",
      "Dates change",
      "Page taken down",
      "Not checkable",
    ],
  },
  {
    bucket: "fall",
    category: "academics",
    title: "Will Fall 2026 I Am Here still drop students who skip Day 2?",
    description:
      "Fall 2026 rule: I Am Here ends 11:59pm Day 2 of the part of term; non-completers dropped.",
    resolution_criteria:
      "Resolves from registrar/COE published I Am Here policy as of Sep 15, 2026.",
    outcomes: [
      "Rule still in effect",
      "Policy softened",
      "Policy reversed",
      "No confirmation by Sep 15",
    ],
  },

  // Dining
  {
    bucket: "spring",
    category: "dining",
    title: "What was the top No Hungry Huskies dining complaint in spring?",
    description: "Dining advocacy themes covered by Huntington News.",
    resolution_criteria:
      "Resolves to the complaint theme most emphasized in spring 2026 Huntington News dining coverage.",
    outcomes: [
      "Meal plan price",
      "Allergy options",
      "Hall hours",
      "Food quality",
      "Walk to IV",
    ],
    winIdx: 0,
  },
  {
    bucket: "spring",
    category: "dining",
    title: "Did Stetson West Outtakes stay open through spring finals week?",
    description: "Outtakes availability during spring finals.",
    resolution_criteria:
      "Resolves YES if Dining hours showed Stetson West Outtakes open on any day of spring 2026 finals week.",
    outcomes: ["Yes", "No"],
    winIdx: 0,
  },
  {
    bucket: "summer",
    category: "dining",
    title: "Will For the Love of Food meal plans take effect Aug 25 as announced?",
    description:
      "Huntington News: revamped semester-based plans announced to start Aug 25.",
    resolution_criteria:
      "Resolves by official Dining effective date for For the Love of Food plans.",
    outcomes: [
      "Yes, Aug 25",
      "Delayed Aug 26–31",
      "Delayed to September",
      "No confirmation by Sep 7",
    ],
  },
  {
    bucket: "summer",
    category: "dining",
    title: "Will IV Outtakes add permanent boba before Fall classes begin?",
    description: "IV Outtakes menu watch before Sep 9.",
    resolution_criteria:
      "Resolves YES if Dining/IV Outtakes lists boba as a regular menu item before Sep 9, 2026.",
    outcomes: ["Yes", "No"],
  },
  {
    bucket: "fall",
    category: "dining",
    title: "Which cafe runs out of oat milk first in week one of Fall classes?",
    description: "Campus cafe supply chaos, week of Sep 9.",
    resolution_criteria:
      "Resolves to the first location with a public/staff-confirmed oat milk stockout Sep 9–15; else None.",
    outcomes: [
      "Snell Café",
      "IV",
      "SquashBusters area",
      "Residence dining",
      "None",
    ],
  },
  {
    bucket: "fall",
    category: "dining",
    title: "Will Dining announce a new late-night option before Sep 30?",
    description: "Late-night dining expansion watch.",
    resolution_criteria:
      "Resolves YES if Dining publishes a new late-night venue or hours expansion before Sep 30, 2026.",
    outcomes: ["Yes", "No"],
  },

  // Wildcard
  {
    bucket: "spring",
    category: "wildcard",
    title: "Which Huntington News theme had the longest comment fight in spring?",
    description: "Campus controversy barometer spring 2026.",
    resolution_criteria:
      "Resolves to the HN story theme with the most sustained comment/debate attention in spring 2026.",
    outcomes: [
      "Near-campus safety",
      "NU Alert policy",
      "Housing costs",
      "Dining reform",
      "Sidechat culture",
    ],
    winIdx: 0,
  },
  {
    bucket: "spring",
    category: "wildcard",
    title: "Did Huntington News publish a Sidechat/Yik Yak feature before May 2026?",
    description: "Anon app campus coverage.",
    resolution_criteria:
      "Resolves YES if huntnewsnu.com published a Sidechat or Yik Yak–focused feature dated before May 1, 2026.",
    outcomes: ["Yes", "No"],
    winIdx: 0,
  },
  {
    bucket: "summer",
    category: "wildcard",
    title: "What does Sidechat rage about most during the Orange Line August shutdown?",
    description: "Anon chatter during Aug 20–30 Orange Line disruption affecting Huskies.",
    resolution_criteria:
      "Resolves to the dominant Sidechat theme if mirrored in Huntington News or widely screenshotted campus posts; else Memes only.",
    outcomes: [
      "Shuttle waits",
      "Late to class",
      "Admin silence",
      "Hot walk to Mass Ave",
      "Memes only",
    ],
  },
  {
    bucket: "summer",
    category: "wildcard",
    title: "Will NU publish another Boston move-in guide update before Aug 1?",
    description:
      "Jul 17 news.northeastern.edu move-in story; bet on a further official update.",
    resolution_criteria:
      "Resolves YES if Housing or news.northeastern.edu publishes a new move-in update dated after Jul 17 and before Aug 1, 2026.",
    outcomes: ["Yes", "No"],
  },
  {
    bucket: "fall",
    category: "wildcard",
    title: "Will Huntington News publish a Fall move-in/housing story by Sep 12?",
    description: "HN coverage of Labor Day weekend move-in.",
    resolution_criteria:
      "Resolves by the earliest huntnewsnu.com Fall 2026 move-in/housing story date.",
    outcomes: [
      "Yes, by Sep 8",
      "Sep 9–12",
      "After Sep 12",
      "No story by Sep 20",
    ],
  },
  {
    bucket: "fall",
    category: "wildcard",
    title: "When does HN next publish a Sidechat/Yik Yak campus story after Sep 9?",
    description: "Anon app + Huntington News crossover in early Fall.",
    resolution_criteria:
      "Resolves by the publish date of the next huntnewsnu.com story primarily about Sidechat or Yik Yak after Sep 9, 2026.",
    outcomes: [
      "Before Sep 23",
      "Sep 23–Oct 9",
      "After Oct 9",
      "None by Nov 1",
    ],
  },
];

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function rest<T>(
  method: string,
  path: string,
  body?: unknown,
  extra: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...SR, Prefer: "return=representation", ...extra },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ([] as unknown as T);
}

async function rpc<T>(
  name: string,
  body: unknown,
  jwt?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${jwt ?? SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(`${BASE}/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`rpc ${name} → ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function signIn(email: string, password: string): Promise<string> {
  let last = "";
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await fetch(`${AUTH}/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const data = (await res.json()) as { access_token: string };
      return data.access_token;
    }
    last = await res.text();
    if (res.status === 429 || /rate.?limit/i.test(last)) {
      const wait = Math.min(30_000, 2000 * 2 ** attempt) + randInt(0, 1000);
      console.warn(`  rate-limited signing ${email}, wait ${Math.round(wait / 1000)}s…`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`sign-in ${email}: ${last}`);
  }
  throw new Error(`sign-in ${email}: ${last}`);
}

/** Serialize auth token grants to stay under Supabase Auth rate limits. */
let signInGate: Promise<void> = Promise.resolve();
const jwtCache = new Map<string, string>();

async function getJwt(email: string): Promise<string> {
  const hit = jwtCache.get(email);
  if (hit) return hit;
  let token = "";
  const run = signInGate.then(async () => {
    await new Promise((r) => setTimeout(r, 1100));
    token = await signIn(email, SEED_PASSWORD);
    jwtCache.set(email, token);
  });
  signInGate = run.then(
    () => undefined,
    () => undefined,
  );
  await run;
  return token;
}

async function ensureAuthUser(
  email: string,
  password: string,
): Promise<string> {
  const existing = await rest<{ id: string }[]>(
    "GET",
    `/profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
  );
  if (existing[0]) return existing[0].id;

  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${AUTH}/admin/users`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      return data.id;
    }
    const text = await res.text();
    if (res.status === 429 || /rate.?limit/i.test(text)) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    const again = await rest<{ id: string }[]>(
      "GET",
      `/profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
    );
    if (again[0]) return again[0].id;
    throw new Error(`create user ${email}: ${text}`);
  }
  const again = await rest<{ id: string }[]>(
    "GET",
    `/profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
  );
  if (again[0]) return again[0].id;
  throw new Error(`create user ${email}: rate limited`);
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return out;
}

async function topUp(userId: string, minBalance: number): Promise<void> {
  const txns = await rest<{ amount: number }[]>(
    "GET",
    `/transactions?user_id=eq.${userId}&select=amount`,
  );
  const bal = txns.reduce((s, t) => s + t.amount, 0);
  if (bal < minBalance) {
    await rest("POST", "/transactions", {
      user_id: userId,
      type: "signup_grant",
      amount: minBalance - bal,
    });
  }
}

async function wipeOpenCatalog(): Promise<void> {
  if (process.env.SKIP_WIPE === "1") {
    console.log("SKIP_WIPE=1 -leaving existing rows alone");
    return;
  }
  console.log(
    "Wiping via REST (price_history / markets). If this fails on transactions, run the SQL wipe in the script header first.",
  );
  await rest("DELETE", "/price_history?id=gte.0", undefined, {
    Prefer: "return=minimal",
  });
  // Cannot DELETE transactions (append-only trigger). Prefer SQL wipe before re-seed.
  try {
    await rest("DELETE", "/bets?id=not.is.null", undefined, {
      Prefer: "return=minimal",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/23503|append-only|P0001/i.test(msg)) {
      throw new Error(
        "Cannot wipe bets while bet_place txs exist. Run SQL wipe (disable transactions_append_only, delete txs/bets/markets), then SKIP_WIPE=1.",
      );
    }
    throw err;
  }
  await rest("DELETE", "/mod_actions?id=not.is.null", undefined, {
    Prefer: "return=minimal",
  });
  await rest("DELETE", "/reports?id=not.is.null", undefined, {
    Prefer: "return=minimal",
  });
  await rest("DELETE", "/markets?id=not.is.null", undefined, {
    Prefer: "return=minimal",
  });
  await rest("DELETE", "/hall_of_fame?rank=gte.0", undefined, {
    Prefer: "return=minimal",
  });
}

async function ensureSpringSemester(): Promise<string> {
  const existing = await rest<{ id: string; name: string }[]>(
    "GET",
    "/semesters?select=id,name&order=starts_at.asc",
  );
  const spring = existing.find((s) => /spring/i.test(s.name));
  if (spring) {
    console.log(`Spring semester exists: ${spring.name}`);
    return spring.id;
  }
  const rows = await rest<{ id: string }[]>("POST", "/semesters", {
    name: "Spring 2026",
    starts_at: "2026-01-06T05:00:00Z",
    ends_at: "2026-05-04T04:00:00Z",
  });
  console.log("Created Spring 2026 semester");
  return rows[0].id;
}

function closeResolveFor(bucket: Bucket): { close: string; resolve: string } {
  const now = Date.now();
  if (bucket === "summer") {
    return {
      close: new Date(now + 18 * DAY).toISOString(),
      resolve: new Date(now + 25 * DAY).toISOString(),
    };
  }
  if (bucket === "fall") {
    return {
      close: new Date(now + 70 * DAY).toISOString(),
      resolve: new Date(now + 85 * DAY).toISOString(),
    };
  }
  // spring: temporary future close for create_market constraint; backdated later
  return {
    close: new Date(now + 3 * DAY).toISOString(),
    resolve: new Date(now + 5 * DAY).toISOString(),
  };
}

interface LiveMarket {
  spec: CatalogMarket;
  id: string;
  outcomeIds: string[];
  creatorIdx: number;
}

async function placeBet(
  email: string,
  marketId: string,
  outcomeId: string,
  amount: number,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = await getJwt(email);
    try {
      const res = await rpc<{ bet_id: string }>(
        "place_bet",
        {
          p_market_id: marketId,
          p_outcome_id: outcomeId,
          p_amount: amount,
        },
        token,
      );
      return res.bet_id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/401|jwt|expired|not authenticated/i.test(msg)) {
        jwtCache.delete(email);
        continue;
      }
      if (/429|rate.?limit/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("place_bet failed after retries");
}

async function backdateBetAndTx(
  marketId: string,
  betId: string,
  _userId: string,
  atIso: string,
): Promise<void> {
  await rest(
    "PATCH",
    `/bets?id=eq.${betId}`,
    { created_at: atIso },
    { Prefer: "return=minimal" },
  );
  // Latest PH snapshot for this market → same timestamp
  const latest = await rest<{ recorded_at: string }[]>(
    "GET",
    `/price_history?market_id=eq.${marketId}&select=recorded_at&order=recorded_at.desc&limit=1`,
  );
  if (latest[0]) {
    await rest(
      "PATCH",
      `/price_history?market_id=eq.${marketId}&recorded_at=eq.${encodeURIComponent(latest[0].recorded_at)}`,
      { recorded_at: atIso },
      { Prefer: "return=minimal" },
    );
  }
  // transactions are append-only (trigger) -backdated in bulk via SQL at end
}

async function seedBetsOnMarket(
  live: LiveMarket,
  predictors: { id: string; email: string }[],
  spanStartMs: number,
  spanEndMs: number,
  targetPredictors: number,
): Promise<number> {
  const n = Math.min(targetPredictors, predictors.length);
  const chosen = shuffle(predictors).slice(0, n);
  const spent = new Map<string, number>();
  let placed = 0;

  const jobs: {
    user: { id: string; email: string };
    outcomeId: string;
    amount: number;
    atMs: number;
  }[] = [];

  for (let i = 0; i < chosen.length; i++) {
    const user = chosen[i];
    const touches = randInt(1, 2);
    for (let t = 0; t < touches; t++) {
      const headroom = CAP_PER_MARKET - (spent.get(user.id) ?? 0);
      if (headroom < 15) break;
      const amount = Math.min(headroom, randInt(15, 75));
      const oi =
        Math.random() < 0.45
          ? 0
          : randInt(0, live.outcomeIds.length - 1);
      const tFrac = (i + t * 0.37) / Math.max(chosen.length, 1);
      const jitter = Math.sin(i * 2.1 + t) * 0.08;
      const atMs = Math.round(
        spanStartMs +
          (spanEndMs - spanStartMs) *
            Math.min(1, Math.max(0, tFrac + jitter)),
      );
      jobs.push({
        user,
        outcomeId: live.outcomeIds[oi],
        amount,
        atMs,
      });
      spent.set(user.id, (spent.get(user.id) ?? 0) + amount);
    }
  }

  jobs.sort((a, b) => a.atMs - b.atMs);

  for (const job of jobs) {
    try {
      const betId = await placeBet(
        job.user.email,
        live.id,
        job.outcomeId,
        job.amount,
      );
      await backdateBetAndTx(
        live.id,
        betId,
        job.user.id,
        new Date(job.atMs).toISOString(),
      );
      placed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/cap|insufficient|balance/i.test(msg)) {
        console.warn(`  bet skip: ${msg.slice(0, 120)}`);
      }
    }
  }
  return placed;
}

async function rebuildPriceHistoryForOpen(): Promise<void> {
  console.log("\nRebuilding densified price_history for open markets…");
  const markets = await rest<
    {
      id: string;
      title: string;
      created_at: string;
      status: string;
      market_outcomes: { id: string; sort_order: number; pool: number }[];
    }[]
  >(
    "GET",
    "/markets?status=eq.open&select=id,title,created_at,status,market_outcomes!market_outcomes_market_id_fkey(id,sort_order,pool)&limit=100",
  );

  const STEP = 12 * 60 * 60 * 1000;

  for (const m of markets) {
    const outcomes = [...m.market_outcomes].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    if (outcomes.length < 2) continue;
    const bets = await rest<
      { outcome_id: string; amount: number; created_at: string }[]
    >(
      "GET",
      `/bets?market_id=eq.${m.id}&select=outcome_id,amount,created_at&order=created_at.asc&limit=5000`,
    );
    if (bets.length === 0) continue;

    const idx = new Map(outcomes.map((o, i) => [o.id, i]));
    const replay = bets
      .map((b) => {
        const i = idx.get(b.outcome_id);
        if (i === undefined) return null;
        return {
          outcomeIdx: i,
          amount: b.amount,
          atMs: new Date(b.created_at).getTime(),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const first = replay[0].atMs;
    const last = replay[replay.length - 1].atMs;
    const openAt = Math.min(
      first,
      Math.max(new Date(m.created_at).getTime(), first - DAY),
    );
    let rows = replayPriceHistory(outcomes.length, replay, { openAtMs: openAt });

    // Spring-era: clip chart at last bet -never stretch into July with a live jump.
    const springEra =
      first < Date.parse("2026-05-01T00:00:00Z") &&
      last < Date.parse("2026-05-15T00:00:00Z");
    const endMs = springEra ? last : Math.max(last, Date.now() - 60_000);
    const lastSnap = rows.filter((r) => r.recordedAtMs === last);
    if (endMs > last + STEP / 2) {
      for (const r of lastSnap) {
        rows.push({ ...r, recordedAtMs: endMs });
      }
    }
    rows = densifyPriceHistory(rows, STEP);

    await rest(
      "DELETE",
      `/price_history?market_id=eq.${m.id}`,
      undefined,
      { Prefer: "return=minimal" },
    );
    const payload = rows.map((r) => ({
      market_id: m.id,
      outcome_id: outcomes[r.outcomeIdx].id,
      implied: r.implied,
      pool: r.pool,
      recorded_at: new Date(r.recordedAtMs).toISOString(),
    }));
    for (let i = 0; i < payload.length; i += 200) {
      await rest("POST", "/price_history", payload.slice(i, i + 200), {
        Prefer: "return=minimal",
      });
    }
    if (springEra) {
      await rest(
        "PATCH",
        `/markets?id=eq.${m.id}`,
        {
          close_at: new Date(last + 2 * DAY).toISOString(),
          resolve_at: new Date(last + 5 * DAY).toISOString(),
        },
        { Prefer: "return=minimal" },
      );
    }
    console.log(`  ${m.id.slice(0, 8)}… ${payload.length} rows`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (process.env.SEED_PHASE === "hof") {
    console.log("SEED_PHASE=hof -snapshot Spring Hall of Fame only");
    const semesters = await rest<{ id: string; name: string }[]>(
      "GET",
      "/semesters?select=id,name",
    );
    const spring = semesters.find((s) => /spring/i.test(s.name));
    if (!spring) throw new Error("Spring semester not found");
    const modEmail = "mod.seed@northeastern.edu";
    const modRows = await rest<{ id: string }[]>(
      "GET",
      `/profiles?email=eq.${encodeURIComponent(modEmail)}&select=id&limit=1`,
    );
    if (!modRows[0]) throw new Error("mod.seed not found");
    await rest(
      "PATCH",
      `/profiles?id=eq.${modRows[0].id}`,
      { role: "admin" },
      { Prefer: "return=minimal" },
    );
    const jwt = await getJwt(modEmail);
    const n = await rpc<number>(
      "snapshot_semester",
      { p_semester_id: spring.id },
      jwt,
    );
    await rest(
      "PATCH",
      `/profiles?id=eq.${modRows[0].id}`,
      { role: "user" },
      { Prefer: "return=minimal" },
    );
    console.log(`HoF rows written: ${n}`);
    return;
  }

  const categoryFilter = (process.env.SEED_CATEGORIES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as Category[];
  const perCategory = process.env.SEED_PER_CATEGORY
    ? Number(process.env.SEED_PER_CATEGORY)
    : null;

  let catalog = CATALOG;
  if (categoryFilter.length > 0) {
    catalog = catalog.filter((c) => categoryFilter.includes(c.category));
  }
  if (perCategory && perCategory > 0) {
    const counts = new Map<Category, number>();
    catalog = catalog.filter((c) => {
      const n = counts.get(c.category) ?? 0;
      if (n >= perCategory) return false;
      counts.set(c.category, n + 1);
      return true;
    });
  }

  if (process.env.SKIP_EXISTING === "1") {
    const existing = await rest<{ title: string }[]>(
      "GET",
      "/markets?select=title&limit=500",
    );
    const titles = new Set(existing.map((m) => m.title));
    const before = catalog.length;
    catalog = catalog.filter((c) => !titles.has(c.title));
    console.log(
      `SKIP_EXISTING=1 -skipped ${before - catalog.length} already-live titles`,
    );
  }

  if (catalog.length === 0) {
    console.log("Nothing to seed (empty catalog after filters).");
    return;
  }

  console.log(`Catalog size: ${catalog.length} markets (of ${CATALOG.length})`);
  console.log(
    `Buckets: spring=${catalog.filter((c) => c.bucket === "spring").length} ` +
      `summer=${catalog.filter((c) => c.bucket === "summer").length} ` +
      `fall=${catalog.filter((c) => c.bucket === "fall").length}`,
  );
  if (categoryFilter.length > 0) {
    console.log(`Categories: ${categoryFilter.join(", ")}`);
  }

  await wipeOpenCatalog();
  const springId = await ensureSpringSemester();

  // Users
  console.log("\nProvisioning seed users…");
  const creatorEmails = Array.from(
    { length: CREATOR_COUNT },
    (_, i) => `creator${String(i + 1).padStart(2, "0")}.seed@northeastern.edu`,
  );
  const predictorEmails = Array.from(
    { length: PREDICTOR_COUNT },
    (_, i) =>
      `predictor${String(i + 1).padStart(3, "0")}.seed@northeastern.edu`,
  );
  const modEmail = "mod.seed@northeastern.edu";

  const creatorIds = await mapPool(creatorEmails, 2, (email) =>
    ensureAuthUser(email, SEED_PASSWORD),
  );
  const predictorIds = await mapPool(predictorEmails, 2, async (email, i) => {
    if (i > 0 && i % 25 === 0) {
      await new Promise((r) => setTimeout(r, 1200));
      console.log(`  users ${i}/${predictorEmails.length}…`);
    }
    return ensureAuthUser(email, SEED_PASSWORD);
  });
  const modId = await ensureAuthUser(modEmail, SEED_PASSWORD);

  // Promote mod for resolve/snapshot; grant real admin if present
  await rest(
    "PATCH",
    `/profiles?id=eq.${modId}`,
    { role: "admin" },
    { Prefer: "return=minimal" },
  );
  const adminRows = await rest<{ id: string }[]>(
    "GET",
    `/profiles?email=eq.${encodeURIComponent(ADMIN_EMAIL)}&select=id&limit=1`,
  );
  if (adminRows[0]) {
    await rest(
      "PATCH",
      `/profiles?id=eq.${adminRows[0].id}`,
      { role: "admin" },
      { Prefer: "return=minimal" },
    );
    console.log(`Granted admin to ${ADMIN_EMAIL}`);
  } else {
    console.log(
      `NOTE: ${ADMIN_EMAIL} has no profile yet -sign up once, then re-run or patch role manually.`,
    );
  }

  console.log("Topping up balances…");
  await mapPool([...creatorIds, ...predictorIds, modId], 8, (id) =>
    topUp(id, 80_000),
  );

  console.log("Signing in creators + mod (predictors sign in lazily)…");
  jwtCache.clear();
  for (const email of creatorEmails) {
    await getJwt(email);
  }
  const modJwt = await getJwt(modEmail);
  const creatorJwts = creatorEmails.map((e) => jwtCache.get(e)!);

  const predictors = predictorIds.map((id, i) => ({
    id,
    email: predictorEmails[i],
  }));

  // Create markets
  console.log("\nCreating markets…");
  const live: LiveMarket[] = [];
  for (let i = 0; i < catalog.length; i++) {
    const spec = catalog[i];
    const creatorIdx = i % CREATOR_COUNT;
    const { close, resolve } = closeResolveFor(spec.bucket);
    const created = await rpc<{
      market_id: string;
      outcomes: { id: string; label: string }[];
    }>(
      "create_market",
      {
        p_title: spec.title,
        p_description: spec.description,
        p_category: spec.category,
        p_resolution_criteria: spec.resolution_criteria,
        p_close_at: close,
        p_resolve_at: resolve,
        p_outcomes: spec.outcomes,
        p_catch_all: false,
        p_auto_flagged: false,
      },
      creatorJwts[creatorIdx],
    );

    // Stable outcome order matching labels
    const byLabel = new Map(
      created.outcomes.map((o) => [o.label.toLowerCase(), o.id]),
    );
    const outcomeIds = spec.outcomes.map((label) => {
      const id = byLabel.get(label.toLowerCase());
      if (!id) throw new Error(`missing outcome ${label} on ${spec.title}`);
      return id;
    });

    live.push({
      spec,
      id: created.market_id,
      outcomeIds,
      creatorIdx,
    });
    console.log(
      `  [${spec.bucket}/${spec.category}] ${spec.title.slice(0, 64)}`,
    );
  }

  // Bets
  console.log("\nSeeding historic bets…");
  const springStart = Date.parse("2026-01-20T15:00:00Z");
  const springEnd = Date.parse("2026-04-20T20:00:00Z");
  const summerStart = Date.parse("2026-05-10T15:00:00Z");
  const summerEnd = Date.now() - 2 * 60 * 60 * 1000;
  const fallStart = Date.now() - 5 * DAY;
  const fallEnd = Date.now() - 30 * 60 * 1000;

  for (const m of live) {
    const target =
      m.spec.bucket === "spring"
        ? randInt(MIN_PREDICTORS_RESOLVED, 150)
        : randInt(MIN_PREDICTORS_OPEN, 90);
    const [a, b] =
      m.spec.bucket === "spring"
        ? [springStart, springEnd]
        : m.spec.bucket === "summer"
          ? [summerStart, summerEnd]
          : [fallStart, fallEnd];
    const n = await seedBetsOnMarket(m, predictors, a, b, target);
    console.log(
      `  ${m.spec.bucket.padEnd(6)} ${String(n).padStart(4)} bets · ${m.spec.title.slice(0, 50)}`,
    );
  }

  // Backdate spring market metadata + resolve
  console.log("\nResolving Spring markets + backdating into Spring window…");
  const springMarkets = live.filter((m) => m.spec.bucket === "spring");
  for (let i = 0; i < springMarkets.length; i++) {
    const m = springMarkets[i];
    const createdAt = new Date(springStart + i * DAY).toISOString();
    const closeAt = new Date(springEnd - 3 * DAY + i * 3600_000).toISOString();
    const resolveAt = new Date(springEnd - DAY + i * 3600_000).toISOString();

    await rest(
      "PATCH",
      `/markets?id=eq.${m.id}`,
      {
        created_at: createdAt,
        close_at: closeAt,
        resolve_at: resolveAt,
        status: "closed",
      },
      { Prefer: "return=minimal" },
    );

    const winIdx = m.spec.winIdx ?? 0;
    await rpc(
      "resolve_market",
      {
        p_market_id: m.id,
        p_action: "resolve",
        p_winning_outcome_id: m.outcomeIds[winIdx],
      },
      modJwt,
    );

    await rest(
      "PATCH",
      `/markets?id=eq.${m.id}`,
      { resolved_at: resolveAt },
      { Prefer: "return=minimal" },
    );

    console.log(`  resolved: ${m.spec.title.slice(0, 60)}`);
  }

  // Demote mod (admin email stays admin if present)
  await rest(
    "PATCH",
    `/profiles?id=eq.${modId}`,
    { role: "user" },
    { Prefer: "return=minimal" },
  );

  console.log(`
⚠  transactions are append-only. Run this SQL (Supabase SQL / MCP), then:
   TX_BACKDATED=1 SEED_PHASE=hof SEED_ENV=dev npx tsx --env-file=.env.local scripts/seed-full-catalog.ts

ALTER TABLE public.transactions DISABLE TRIGGER transactions_append_only;
UPDATE public.transactions t
SET created_at = b.created_at
FROM public.bets b
WHERE t.bet_id = b.id AND t.type = 'bet_place';
UPDATE public.transactions t
SET created_at = m.resolved_at
FROM public.markets m
WHERE t.market_id = m.id
  AND m.status = 'resolved'
  AND t.type IN ('bet_payout', 'market_refund', 'vig_burn')
  AND m.resolved_at IS NOT NULL;
ALTER TABLE public.transactions ENABLE TRIGGER transactions_append_only;
`);

  await rebuildPriceHistoryForOpen();

  // Hall of Fame -Spring only (requires transaction backdate SQL first)
  if (process.env.TX_BACKDATED === "1") {
    console.log("\nSnapshotting Spring Hall of Fame…");
    await rest(
      "PATCH",
      `/profiles?id=eq.${modId}`,
      { role: "admin" },
      { Prefer: "return=minimal" },
    );
    jwtCache.delete(modEmail);
    const freshModJwt = await getJwt(modEmail);
    const hofCount = await rpc<number>(
      "snapshot_semester",
      { p_semester_id: springId },
      freshModJwt,
    );
    console.log(`  HoF rows: ${hofCount}`);
    await rest(
      "PATCH",
      `/profiles?id=eq.${modId}`,
      { role: "user" },
      { Prefer: "return=minimal" },
    );
  } else {
    console.log(
      "\nSkipping HoF snapshot until TX_BACKDATED=1 SEED_PHASE=hof after SQL.",
    );
  }

  // Summary
  const openCount = await rest<{ id: string }[]>(
    "GET",
    "/markets?status=eq.open&select=id",
  );
  const resolvedCount = await rest<{ id: string }[]>(
    "GET",
    "/markets?status=eq.resolved&select=id",
  );
  const hof = await rest<{ rank: number; display_name_snapshot: string; score: number }[]>(
    "GET",
    `/hall_of_fame?semester_id=eq.${springId}&select=rank,display_name_snapshot,score&order=rank.asc`,
  );

  console.log("\n── Done ──────────────────────────────────────────────");
  console.log(`Open markets:     ${openCount.length}`);
  console.log(`Resolved (HoF):   ${resolvedCount.length}`);
  console.log(`Spring HoF top ${hof.length}:`);
  for (const row of hof.slice(0, 10)) {
    console.log(
      `  #${row.rank} ${row.display_name_snapshot} · ${row.score}`,
    );
  }
  console.log(`\nRe-run: SEED_ENV=dev npx tsx --env-file=.env.local scripts/seed-full-catalog.ts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
