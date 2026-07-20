#!/usr/bin/env node
// Seed demo markets across all categories via the create_market engine RPC
// (E-6 / S6-1: engine-first, so the AR-5 insert order and outcome validation
// are exercised by the seed itself). Markets get a 2/3/4/5/6-outcome mix (D-7).
// Works on Node.js 20+ (no WebSocket needed — plain fetch only).
//
// Usage from repo root:
//   SEED_ENV=dev npx tsx --env-file=.env.local scripts/seed-markets.ts

// Non-prod guard (S6-1): refuse to run unless explicitly marked as a dev seed.
if (process.env.SEED_ENV !== "dev") {
  console.error("Refusing to seed: set SEED_ENV=dev (non-prod only).");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BASE = `${SUPABASE_URL}/rest/v1`;
const AUTH_BASE = `${SUPABASE_URL}/auth/v1`;
const HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// The engine's create_market RPC runs as the caller (auth.uid()), so seeding
// needs a real user JWT — the service role key alone is rejected. A dedicated
// seed creator is provisioned via the Auth Admin API, then signed in.
const SEED_CREATOR = {
  email: "creator.seed@northeastern.edu",
  password: "HuskyM4rkets!Creator",
};

// Outcome-label mix for the catalog, cycled by market index (D-7).
import { seedOutcomeSets } from "../src/lib/seed-plan";

const OUTCOME_SETS = seedOutcomeSets();

async function pg<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ([] as unknown as T);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

type MarketInsert = {
  title: string;
  description?: string;
  category: "campus" | "transit" | "weather" | "sports" | "academics" | "dining" | "wildcard";
  close_at: string;
  resolve_at: string;
  resolution_criteria: string;
  outcomes?: string[]; // explicit labels override the cycled OUTCOME_SETS for this market
};

const MARKETS: MarketInsert[] = [
  // ── Campus ────────────────────────────────────────────────────────────────
  {
    category: "campus",
    title: "Will the library extend hours during finals week?",
    description: "Snell Library finals week hours are historically extended — will they announce the same for this semester?",
    close_at: daysFromNow(7),
    resolve_at: daysFromNow(14),
    resolution_criteria: "Resolves YES if Northeastern officially announces extended Snell Library hours for finals week on the library website.",
  },
  {
    category: "campus",
    title: "Will the Student Union renovation finish by semester end?",
    description: "The Student Union renovation has faced multiple delays. Will it wrap up before the last day of finals?",
    close_at: daysFromNow(14),
    resolve_at: daysFromNow(30),
    resolution_criteria: "Resolves YES if an official Northeastern announcement confirms the Student Union renovation is fully complete before the last day of finals this semester.",
  },
  {
    category: "campus",
    title: "Will campus parking permit prices increase next semester?",
    close_at: daysFromNow(21),
    resolve_at: daysFromNow(45),
    resolution_criteria: "Resolves YES if Northeastern Transportation Services publishes updated parking permit pricing that is higher than the current semester rates.",
  },
  {
    category: "campus",
    title: "Will the new campus gym facility open before spring break?",
    close_at: daysFromNow(10),
    resolve_at: daysFromNow(25),
    resolution_criteria: "Resolves YES if the new Cabot Athletic Center expansion officially opens its doors to students before the first day of spring break.",
  },
  {
    category: "campus",
    title: "Will campus WiFi get a major upgrade announcement this semester?",
    close_at: daysFromNow(30),
    resolve_at: daysFromNow(60),
    resolution_criteria: "Resolves YES if Northeastern ITS issues a campus-wide communication about a significant WiFi infrastructure upgrade occurring this semester.",
  },
  {
    category: "campus",
    title: "Will Northeastern host a major keynote speaker event this semester?",
    description: "A 'major' speaker means a nationally recognized public figure, CEO, or politician.",
    close_at: daysFromNow(20),
    resolve_at: daysFromNow(50),
    resolution_criteria: "Resolves YES if Northeastern hosts an officially ticketed keynote featuring a nationally recognized figure before the end of the semester.",
  },
  {
    category: "campus",
    title: "Will the campus bookstore offer 20%+ off during finals week?",
    close_at: daysFromNow(7),
    resolve_at: daysFromNow(16),
    resolution_criteria: "Resolves YES if the Northeastern Bookstore advertises a storewide discount of 20% or more during finals week via email or in-store signage.",
  },
  {
    category: "campus",
    title: "Will a new campus coffee shop open on Huntington Ave this month?",
    close_at: daysFromNow(12),
    resolve_at: daysFromNow(32),
    resolution_criteria: "Resolves YES if a new coffee or cafe establishment opens for business on Huntington Avenue between Mass Ave and Ruggles within 30 days.",
  },
  {
    category: "campus",
    title: "Will the quad renovation project finish ahead of its stated schedule?",
    close_at: daysFromNow(18),
    resolve_at: daysFromNow(40),
    resolution_criteria: "Resolves YES if Northeastern Facilities announces that the quad renovation is complete at least two weeks before its originally published completion date.",
  },
  {
    category: "campus",
    title: "Will a campus building be renamed in honor of a donor this semester?",
    close_at: daysFromNow(25),
    resolve_at: daysFromNow(55),
    resolution_criteria: "Resolves YES if Northeastern publicly announces a building or campus facility naming gift and renaming this semester.",
  },

  // ── Transit ────────────────────────────────────────────────────────────────
  {
    category: "transit",
    title: "Will the MBTA Green Line run on time 90%+ of rush-hour trips this week?",
    description: "Based on MBTA Performance Dashboard data for E and D branches serving Northeastern.",
    close_at: daysFromNow(5),
    resolve_at: daysFromNow(8),
    resolution_criteria: "Resolves YES if the MBTA Performance Dashboard shows on-time performance of 90% or higher for Green Line E/D branches during rush hours (7–9am, 4–7pm) for the current week.",
  },
  {
    category: "transit",
    title: "Will the MBTA announce a weekend service suspension near campus this month?",
    close_at: daysFromNow(10),
    resolve_at: daysFromNow(32),
    resolution_criteria: "Resolves YES if the MBTA announces any planned weekend service suspension on the Green Line E branch or Orange Line affecting stops within 0.5 miles of Northeastern.",
  },
  {
    category: "transit",
    title: "Will Northeastern add a new shuttle route or stop this semester?",
    close_at: daysFromNow(20),
    resolve_at: daysFromNow(50),
    resolution_criteria: "Resolves YES if Northeastern Transportation Services officially announces a new shuttle route, stop, or expanded service area on the campus shuttle system this semester.",
  },
  {
    category: "transit",
    title: "Will Bluebikes add new docking stations near Northeastern this month?",
    close_at: daysFromNow(12),
    resolve_at: daysFromNow(35),
    resolution_criteria: "Resolves YES if Bluebikes installs at least one new docking station within a 10-minute walk of the main Northeastern campus quad within 30 days.",
  },
  {
    category: "transit",
    title: "Will the MBTA announce a fare increase before the end of the semester?",
    close_at: daysFromNow(25),
    resolve_at: daysFromNow(55),
    resolution_criteria: "Resolves YES if the MBTA Board votes to approve or officially proposes any fare increase effective within the next 12 months before the last day of classes.",
  },
  {
    category: "transit",
    title: "Will the Red Line experience 3+ major delays in a single week?",
    description: "A 'major delay' means 20+ minutes of service disruption per MBTA alerts.",
    close_at: daysFromNow(4),
    resolve_at: daysFromNow(10),
    resolution_criteria: "Resolves YES if T-Alerts sends 3 or more Red Line delay notifications of 20 minutes or longer within any 7-day window this week.",
  },
  {
    category: "transit",
    title: "Will Uber/Lyft surge pricing exceed 3x on campus during the semester's biggest event?",
    close_at: daysFromNow(30),
    resolve_at: daysFromNow(60),
    resolution_criteria: "Resolves YES if any rideshare user can document (screenshot with timestamp) a 3x or higher surge multiplier for pickups within 0.5 miles of campus during a major Northeastern event.",
  },
  {
    category: "transit",
    title: "Will a snowstorm cause campus shuttle cancellations this month?",
    close_at: daysFromNow(15),
    resolve_at: daysFromNow(35),
    resolution_criteria: "Resolves YES if Northeastern Transportation Services cancels or suspends campus shuttle service for at least one full day due to weather within the next 30 days.",
  },
  {
    category: "transit",
    title: "Will the Columbus Ave parking garage hit full capacity before midterms?",
    close_at: daysFromNow(8),
    resolve_at: daysFromNow(20),
    resolution_criteria: "Resolves YES if the Columbus Ave parking garage displays a 'Full' indicator during a weekday before the official midterm exam period begins.",
  },
  {
    category: "transit",
    title: "Will the MBTA introduce mobile ticketing improvements before summer?",
    close_at: daysFromNow(40),
    resolve_at: daysFromNow(80),
    resolution_criteria: "Resolves YES if the MBTA mTicket or Subway mobile app receives an update adding at least one new rider-facing feature (e.g., real-time crowding, tap-to-pay) before June 1st.",
  },

  // ── Weather ────────────────────────────────────────────────────────────────
  {
    category: "weather",
    title: "Will Boston get 6+ inches of snow in a single storm before February?",
    close_at: daysFromNow(20),
    resolve_at: daysFromNow(40),
    resolution_criteria: "Resolves YES if the National Weather Service Boston records 6 or more inches of snowfall from a single storm at Logan Airport before February 1st.",
  },
  {
    category: "weather",
    title: "Will the high temperature in Boston exceed 60°F this week?",
    close_at: daysFromNow(3),
    resolve_at: daysFromNow(7),
    resolution_criteria: "Resolves YES if the official NWS Boston observation at Logan Airport records a daily high of 60°F or above on any day this week (Monday–Sunday).",
  },
  {
    category: "weather",
    title: "Will it rain on Northeastern's commencement day?",
    description: "Spring commencement is held outdoors on the quad — rain would force a move indoors.",
    close_at: daysFromNow(90),
    resolve_at: daysFromNow(100),
    resolution_criteria: "Resolves YES if NWS Boston records measurable rainfall (0.01 inch or more) at Logan Airport during the hours of Northeastern's official spring commencement ceremony.",
  },
  {
    category: "weather",
    title: "Will Boston temperatures drop below 0°F this winter?",
    close_at: daysFromNow(30),
    resolve_at: daysFromNow(75),
    resolution_criteria: "Resolves YES if the official NWS Boston observation records a temperature reading below 0°F (not wind chill) at any point before March 15th.",
  },
  {
    category: "weather",
    title: "Will there be a snow day canceling Northeastern classes before March?",
    close_at: daysFromNow(20),
    resolve_at: daysFromNow(55),
    resolution_criteria: "Resolves YES if Northeastern University officially cancels in-person classes or moves to remote instruction for a full day due to winter weather before March 1st.",
  },
  {
    category: "weather",
    title: "Will the first 70°F day of 2025 in Boston occur before April 15th?",
    close_at: daysFromNow(60),
    resolve_at: daysFromNow(90),
    resolution_criteria: "Resolves YES if the NWS Boston official observation at Logan Airport records a high temperature of 70°F or above before April 15th, 2025.",
  },
  {
    category: "weather",
    title: "Will a nor'easter bring a travel ban to the Boston area this winter?",
    close_at: daysFromNow(25),
    resolve_at: daysFromNow(65),
    resolution_criteria: "Resolves YES if the Governor of Massachusetts or the Mayor of Boston declares a travel ban due to a nor'easter at any point before March 21st.",
  },
  {
    category: "weather",
    title: "Will Boston receive less than average snowfall for the full winter season?",
    description: "Boston's historical average seasonal snowfall is ~43 inches.",
    close_at: daysFromNow(80),
    resolve_at: daysFromNow(120),
    resolution_criteria: "Resolves YES if the NWS Boston seasonal snowfall total for this winter (October–April) is below 43 inches at the end of the season.",
  },
  {
    category: "weather",
    title: "Will there be a heat advisory issued for Boston this summer?",
    close_at: daysFromNow(120),
    resolve_at: daysFromNow(150),
    resolution_criteria: "Resolves YES if the NWS Boston issues an official Heat Advisory or Excessive Heat Warning for the Boston metro area between June 1st and August 31st.",
  },
  {
    category: "weather",
    title: "Will the Charles River freeze over this winter?",
    description: "A full surface freeze visible from the BU Bridge is the standard benchmark.",
    close_at: daysFromNow(30),
    resolve_at: daysFromNow(70),
    resolution_criteria: "Resolves YES if news reports or official sources confirm the Charles River has frozen over visibly (at least from bridge to shore) in the Back Bay/Cambridge section.",
  },

  // ── Sports ────────────────────────────────────────────────────────────────
  {
    category: "sports",
    title: "Will the Huskies men's basketball team make the NCAA tournament?",
    close_at: daysFromNow(60),
    resolve_at: daysFromNow(80),
    resolution_criteria: "Resolves YES if Northeastern men's basketball receives an at-large bid or wins their conference tournament to earn an NCAA tournament berth this season.",
  },
  {
    category: "sports",
    title: "Will Northeastern hockey finish in the top 3 of HEA standings?",
    close_at: daysFromNow(45),
    resolve_at: daysFromNow(65),
    resolution_criteria: "Resolves YES if Northeastern men's hockey finishes the regular Hockey East season ranked 3rd or higher in the conference standings.",
  },
  {
    category: "sports",
    title: "Will the Huskies women's soccer team win their next three home games?",
    close_at: daysFromNow(12),
    resolve_at: daysFromNow(25),
    resolution_criteria: "Resolves YES if Northeastern women's soccer wins all three of their next scheduled home games without a loss or draw.",
  },
  {
    category: "sports",
    title: "Will any Northeastern athlete win a CAA conference Player of the Week award this month?",
    close_at: daysFromNow(14),
    resolve_at: daysFromNow(35),
    resolution_criteria: "Resolves YES if any Northeastern athlete is officially named CAA Player of the Week (or equivalent) in any sport within the next 30 days.",
  },
  {
    category: "sports",
    title: "Will the Huskies swim team set a new school record at their next invitational?",
    close_at: daysFromNow(8),
    resolve_at: daysFromNow(15),
    resolution_criteria: "Resolves YES if any Northeastern swimmer breaks an official school record during the team's next intercollegiate invitational meet per GonortheasternHuskies.com.",
  },
  {
    category: "sports",
    title: "Will Northeastern's men's lacrosse team win their next 5 games?",
    close_at: daysFromNow(20),
    resolve_at: daysFromNow(40),
    resolution_criteria: "Resolves YES if Northeastern men's lacrosse wins their next five consecutive games without a loss.",
  },
  {
    category: "sports",
    title: "Will a Northeastern athlete sign a professional contract this semester?",
    close_at: daysFromNow(45),
    resolve_at: daysFromNow(70),
    resolution_criteria: "Resolves YES if any current or recently graduated Northeastern athlete signs a professional playing contract (any sport, any league) before semester end.",
  },
  {
    category: "sports",
    title: "Will the Huskies women's basketball team win their conference opener?",
    close_at: daysFromNow(5),
    resolve_at: daysFromNow(8),
    resolution_criteria: "Resolves YES if Northeastern women's basketball wins their first official conference game of the season as recorded in official box scores.",
  },
  {
    category: "sports",
    title: "Will Northeastern field hockey reach the CAA tournament semifinals?",
    close_at: daysFromNow(30),
    resolve_at: daysFromNow(50),
    resolution_criteria: "Resolves YES if Northeastern field hockey advances to the semifinal round of the CAA championship tournament this season.",
  },
  {
    category: "sports",
    title: "Will the Huskies men's rowing team podium at the Head of the Charles?",
    description: "The Head of the Charles Regatta is the world's largest 2-day regatta, held in Boston.",
    close_at: daysFromNow(60),
    resolve_at: daysFromNow(75),
    resolution_criteria: "Resolves YES if Northeastern men's rowing finishes 1st, 2nd, or 3rd in any of their entered events at the Head of the Charles Regatta.",
  },

  // ── Academics ────────────────────────────────────────────────────────────────
  {
    category: "academics",
    title: "Will the CS department announce a new AI/ML course for next semester?",
    close_at: daysFromNow(30),
    resolve_at: daysFromNow(60),
    resolution_criteria: "Resolves YES if Northeastern Khoury publishes a new AI or machine learning course in the course registration system for the upcoming semester.",
  },
  {
    category: "academics",
    title: "Will Northeastern rank in the top 50 in the next US News rankings?",
    close_at: daysFromNow(90),
    resolve_at: daysFromNow(120),
    resolution_criteria: "Resolves YES if Northeastern University is ranked 50th or higher in the next published US News & World Report Best National Universities rankings.",
  },
  {
    category: "academics",
    title: "Will the co-op office report 95%+ placement rate for this cycle?",
    close_at: daysFromNow(45),
    resolve_at: daysFromNow(75),
    resolution_criteria: "Resolves YES if Northeastern officially reports a co-op placement rate of 95% or higher for the current placement cycle in any official publication.",
  },
  {
    category: "academics",
    title: "Will a Northeastern professor win a major national research award this semester?",
    close_at: daysFromNow(50),
    resolve_at: daysFromNow(80),
    resolution_criteria: "Resolves YES if a current Northeastern faculty member receives a national-level award (NSF CAREER, Guggenheim, MacArthur, etc.) this semester per official announcement.",
  },
  {
    category: "academics",
    title: "Will a new interdisciplinary major be officially announced before summer?",
    close_at: daysFromNow(60),
    resolve_at: daysFromNow(90),
    resolution_criteria: "Resolves YES if Northeastern formally announces a new degree program combining two or more academic disciplines before June 1st.",
  },
  {
    category: "academics",
    title: "Will the minimum GPA cutoff for popular majors increase next cycle?",
    description: "Tracks minimum GPA thresholds for declaration of popular majors like CS or Business.",
    close_at: daysFromNow(35),
    resolve_at: daysFromNow(65),
    resolution_criteria: "Resolves YES if Northeastern publishes updated major declaration requirements showing an increase in minimum GPA for at least two of the top-10 most popular majors.",
  },
  {
    category: "academics",
    title: "Will Northeastern expand its London campus programming this academic year?",
    close_at: daysFromNow(40),
    resolve_at: daysFromNow(70),
    resolution_criteria: "Resolves YES if Northeastern officially announces new programs, expanded enrollment, or new facilities at Northeastern University London this academic year.",
  },
  {
    category: "academics",
    title: "Will the undergraduate research office award 50+ grants this semester?",
    close_at: daysFromNow(30),
    resolve_at: daysFromNow(55),
    resolution_criteria: "Resolves YES if Northeastern PEAK Experiences confirms distributing 50 or more individual undergraduate research grants this semester.",
  },
  {
    category: "academics",
    title: "Will the law school clinics take on a nationally notable case this year?",
    close_at: daysFromNow(70),
    resolve_at: daysFromNow(100),
    resolution_criteria: "Resolves YES if Northeastern School of Law's clinical programs take on a case that receives coverage in a national news outlet within the academic year.",
  },
  {
    category: "academics",
    title: "Will Northeastern receive a $10M+ research grant this semester?",
    close_at: daysFromNow(55),
    resolve_at: daysFromNow(85),
    resolution_criteria: "Resolves YES if Northeastern publicly announces receipt of a single research grant or contract of $10 million or more this semester.",
  },

  // ── Dining ────────────────────────────────────────────────────────────────
  {
    category: "dining",
    title: "Will Stetson East add a new international cuisine station this month?",
    close_at: daysFromNow(10),
    resolve_at: daysFromNow(32),
    resolution_criteria: "Resolves YES if Northeastern Dining Services officially announces or opens a new rotating international cuisine concept at Stetson East within 30 days.",
  },
  {
    category: "dining",
    title: "Will dining satisfaction scores improve in the next student survey?",
    description: "Based on the annual or semesterly Northeastern student satisfaction survey results.",
    close_at: daysFromNow(60),
    resolve_at: daysFromNow(90),
    resolution_criteria: "Resolves YES if the next Northeastern student satisfaction survey shows any positive improvement in the dining satisfaction score vs. the most recent prior survey.",
  },
  {
    category: "dining",
    title: "Will the meal plan price increase for the next academic year?",
    close_at: daysFromNow(30),
    resolve_at: daysFromNow(60),
    resolution_criteria: "Resolves YES if Northeastern Housing & Residential Life publishes updated meal plan pricing for next academic year that is higher than current rates for any plan tier.",
  },
  {
    category: "dining",
    title: "Will a new food truck permanently join the campus rotation this semester?",
    close_at: daysFromNow(20),
    resolve_at: daysFromNow(50),
    resolution_criteria: "Resolves YES if Northeastern Dining Services or Facilities Management announces a new permanent food truck location or vendor on campus grounds this semester.",
  },
  {
    category: "dining",
    title: "Will the dining halls extend late-night hours during finals week?",
    close_at: daysFromNow(7),
    resolve_at: daysFromNow(18),
    resolution_criteria: "Resolves YES if Northeastern Dining posts extended late-night hours (past midnight) for any main dining hall during finals week on their official website or social media.",
  },
  {
    category: "dining",
    title: "Will Outtakes introduce a new specialty hot beverage this semester?",
    close_at: daysFromNow(25),
    resolve_at: daysFromNow(55),
    resolution_criteria: "Resolves YES if the Outtakes dining location adds a new hot beverage option to its permanent menu this semester per in-store menus or Dining Services announcements.",
  },
  {
    category: "dining",
    title: "Will a vegan entree be added to every dining station at IV this semester?",
    description: "International Village is the largest dining hall on campus.",
    close_at: daysFromNow(20),
    resolve_at: daysFromNow(45),
    resolution_criteria: "Resolves YES if Northeastern Dining Services announces or demonstrates (via published menus) that every active food station at International Village offers at least one vegan entree this semester.",
  },
  {
    category: "dining",
    title: "Will International Village host a pop-up themed dining event in the next two weeks?",
    close_at: daysFromNow(7),
    resolve_at: daysFromNow(15),
    resolution_criteria: "Resolves YES if Northeastern Dining Services hosts a themed dining event (cultural night, seasonal menu takeover, chef showcase) at International Village within 14 days.",
  },
  {
    category: "dining",
    title: "Will the campus Starbucks have a 20+ minute wait at peak hour this week?",
    description: "Peak hours are 8–10am on weekdays. Long lines are notoriously common.",
    close_at: daysFromNow(3),
    resolve_at: daysFromNow(7),
    resolution_criteria: "Resolves YES if at least 3 Northeastern students independently report (with timestamp) a 20+ minute wait at campus Starbucks during morning peak hours this week.",
  },
  {
    category: "dining",
    title: "Will Northeastern Dining launch a mobile pre-order feature before spring?",
    close_at: daysFromNow(50),
    resolve_at: daysFromNow(80),
    resolution_criteria: "Resolves YES if Northeastern Dining Services launches or announces a mobile pre-order or order-ahead feature for any campus dining location before spring semester starts.",
  },

  // ── Wildcard ────────────────────────────────────────────────────────────────
  {
    category: "wildcard",
    title: "Will a viral social media video be filmed on Northeastern's campus this week?",
    description: "Viral = 100k+ views within 72 hours of posting, clearly showing Northeastern campus.",
    close_at: daysFromNow(5),
    resolve_at: daysFromNow(8),
    resolution_criteria: "Resolves YES if a video filmed on Northeastern's main campus accumulates 100,000+ views on TikTok, Instagram, or YouTube within 72 hours of posting, before market close.",
  },
  {
    category: "wildcard",
    title: "Will a celebrity be spotted on Huntington Ave before finals?",
    description: "Film shoots, sports events, and concerts in the Fenway area make this plausible.",
    close_at: daysFromNow(20),
    resolve_at: daysFromNow(35),
    resolution_criteria: "Resolves YES if a nationally recognizable celebrity is credibly photographed on Huntington Avenue between Northeastern's campus and Fenway Park before the final exam period.",
  },
  {
    category: "wildcard",
    title: "Will the therapy dog event on campus draw 300+ attendees this semester?",
    description: "Northeastern regularly hosts therapy dog de-stress events.",
    close_at: daysFromNow(15),
    resolve_at: daysFromNow(30),
    resolution_criteria: "Resolves YES if an official Northeastern therapy dog event is held and Student Affairs reports or posts attendance of 300 or more students.",
  },
  {
    category: "wildcard",
    title: "Will a Northeastern student appear on a nationally broadcast TV show or major podcast?",
    close_at: daysFromNow(40),
    resolve_at: daysFromNow(70),
    resolution_criteria: "Resolves YES if a current Northeastern student appears on a television show with national distribution or a podcast with 100,000+ monthly listeners.",
  },
  {
    category: "wildcard",
    title: "Will Northeastern make an unscheduled major announcement before the weekend?",
    description: "Surprise announcements have included partnerships, facilities, and leadership changes.",
    close_at: daysFromNow(3),
    resolve_at: daysFromNow(6),
    resolution_criteria: "Resolves YES if Northeastern sends an unscheduled campus-wide email or posts an urgent news story on news.northeastern.edu announcing a significant development before Friday at 5pm.",
  },
  {
    category: "wildcard",
    title: "Will a campus-wide power outage affect 3+ buildings this semester?",
    close_at: daysFromNow(30),
    resolve_at: daysFromNow(60),
    resolution_criteria: "Resolves YES if Northeastern Facilities or the local utility reports a power outage affecting 3 or more major campus buildings simultaneously for at least 30 minutes this semester.",
  },
  {
    category: "wildcard",
    title: "Will Northeastern host a surprise free concert or performance for students this month?",
    close_at: daysFromNow(12),
    resolve_at: daysFromNow(32),
    resolution_criteria: "Resolves YES if Northeastern Student Life hosts a free, unannounced (announced less than 48 hours in advance) musical or entertainment event open to all students within 30 days.",
  },
  {
    category: "wildcard",
    title: "Will the famous Northeastern campus squirrels cause a documented safety incident?",
    description: "The fearless campus squirrels have a history of bold behavior near outdoor dining.",
    close_at: daysFromNow(10),
    resolve_at: daysFromNow(20),
    resolution_criteria: "Resolves YES if a verifiable report (news article, official incident report, or widely-circulated evidence) of a campus squirrel causing a safety or food-safety incident appears within 20 days.",
  },
  {
    category: "wildcard",
    title: "Will a Northeastern research project make national news this semester?",
    close_at: daysFromNow(45),
    resolve_at: daysFromNow(75),
    resolution_criteria: "Resolves YES if a Northeastern University research project is reported by a national news outlet (AP, Reuters, New York Times, Washington Post, NPR) during this semester.",
  },
  {
    category: "wildcard",
    title: "Will a Northeastern student organization win a national competition this semester?",
    close_at: daysFromNow(50),
    resolve_at: daysFromNow(80),
    resolution_criteria: "Resolves YES if any official Northeastern student club, team, or organization wins a national-level competition (hackathon, case competition, academic bowl, etc.) reported by Northeastern News.",
  },

  // ── Multi-option markets — Northeastern 2026 ──────────────────────────────
  {
    category: "academics",
    title: "What will Northeastern's final US News National Universities rank be in 2026?",
    description: "NU has climbed steadily — from #49 in 2020 to #34 in 2024. Where does 2026 land?",
    close_at: daysFromNow(120),
    resolve_at: daysFromNow(150),
    resolution_criteria: "Resolves to the band that contains Northeastern's rank in the US News & World Report 2026 Best National Universities list, published in fall 2025.",
    outcomes: ["Top 30", "31–35", "36–40", "41–45"],
  },
  {
    category: "academics",
    title: "Which Northeastern college will launch the most new degree programs in 2026?",
    description: "Khoury, D'Amore-McKim, Engineering, and Bouvé are all expanding. Who moves fastest?",
    close_at: daysFromNow(90),
    resolve_at: daysFromNow(130),
    resolution_criteria: "Resolves to whichever college publishes the most net-new degree or certificate programs in the Northeastern course catalog by August 2026. Ties resolved by earlier publish date.",
    outcomes: ["Khoury (CS & Data)", "D'Amore-McKim (Business)", "College of Engineering", "Bouvé (Health Sciences)"],
  },
  {
    category: "academics",
    title: "What will be the highest-demand co-op sector for NU students in the Spring 2026 cycle?",
    description: "The co-op office placement data by sector — which industry absorbs the most Huskies?",
    close_at: daysFromNow(60),
    resolve_at: daysFromNow(100),
    resolution_criteria: "Resolves to the employment sector with the highest number of Northeastern co-op placements in the Spring 2026 cycle as reported by the Co-op & Careers office.",
    outcomes: ["Tech / AI / Software", "Healthcare & Biotech", "Finance & Consulting", "Government & Nonprofits"],
  },
  {
    category: "campus",
    title: "Which Northeastern global campus will see the largest enrollment growth in Fall 2026?",
    description: "NU's global network (Oakland, Portland, Vancouver, Miami, London) keeps expanding. Which location surges?",
    close_at: daysFromNow(100),
    resolve_at: daysFromNow(140),
    resolution_criteria: "Resolves to the NU global campus that records the highest percentage year-over-year enrollment increase in official Fall 2026 enrollment data vs. Fall 2025.",
    outcomes: ["Oakland", "Portland", "Vancouver", "Miami", "London"],
  },
  {
    category: "campus",
    title: "Which major campus construction project will break ground first in 2026?",
    description: "Several projects are in the pipeline — sciences complex, graduate housing, innovation center, and athletics expansion.",
    close_at: daysFromNow(80),
    resolve_at: daysFromNow(120),
    resolution_criteria: "Resolves to the project for which Northeastern Facilities Management officially initiates groundbreaking (permit issued + site work started) first in calendar year 2026.",
    outcomes: ["Life Sciences Research Hub", "Graduate Housing Tower", "Interdisciplinary Innovation Center", "Athletics Facility Expansion"],
  },
  {
    category: "campus",
    title: "What will Northeastern announce as its next major philanthropic naming gift in 2026?",
    description: "NU has a history of large naming gifts (Khoury, Bouvé, D'Amore-McKim). The next $50M+ gift is expected in 2026.",
    close_at: daysFromNow(110),
    resolve_at: daysFromNow(150),
    resolution_criteria: "Resolves to the area receiving the next publicly announced $50M+ naming gift in calendar year 2026. Resolves N/A if no qualifying gift is announced.",
    outcomes: ["School of Law", "College of Arts & Sciences", "School of Engineering", "New Research Institute", "No gift announced"],
  },
  {
    category: "sports",
    title: "How many Hockey East regular-season wins will Northeastern men's hockey finish with in 2025–26?",
    description: "The Huskies have been competitive in HEA — where does the final win total land?",
    close_at: daysFromNow(55),
    resolve_at: daysFromNow(75),
    resolution_criteria: "Resolves to the win-count band matching Northeastern men's hockey's final Hockey East regular-season record as published on hockeyeast.com at season end.",
    outcomes: ["20+ wins", "16–19 wins", "12–15 wins", "Under 12 wins"],
  },
  {
    category: "sports",
    title: "Which Northeastern team will win a conference championship title in Spring 2026?",
    description: "CAA and HEA titles are on the table across multiple sports. Who brings home hardware?",
    close_at: daysFromNow(70),
    resolve_at: daysFromNow(100),
    resolution_criteria: "Resolves to the first Northeastern team to win an official conference championship (regular season or tournament) in Spring 2026. Resolves 'None' if no team wins a title.",
    outcomes: ["Men's Hockey (HEA)", "Men's Lacrosse (CAA)", "Women's Basketball (CAA)", "Women's Soccer (CAA)", "None"],
  },
  {
    category: "transit",
    title: "Which MBTA line will cause the most documented service disruptions near NU in Spring 2026?",
    description: "Green Line E Branch and Orange Line both serve Northeastern heavily — neither has a clean track record.",
    close_at: daysFromNow(40),
    resolve_at: daysFromNow(70),
    resolution_criteria: "Resolves to the MBTA line with the highest number of T-Alerts delay notifications of 15+ minutes affecting stops within 0.5 miles of Northeastern between January 1 and May 31, 2026.",
    outcomes: ["Green Line E Branch", "Orange Line", "Green Line D Branch", "Bus network (39 / 1 / CT2)"],
  },
  {
    category: "dining",
    title: "What new dining concept will open on Northeastern's Boston campus in 2026?",
    description: "Dining Services has hinted at new vendors. Will it be a local staple, a national chain, or something unique to NU?",
    close_at: daysFromNow(60),
    resolve_at: daysFromNow(90),
    resolution_criteria: "Resolves to the category that best describes the first net-new dining vendor or concept opening on the main Boston campus in calendar year 2026, per official Dining Services announcement.",
    outcomes: ["Local Boston restaurant brand", "National fast-casual chain", "NU-exclusive concept", "International cuisine specialist"],
  },
  {
    category: "wildcard",
    title: "What will be the biggest Northeastern news story of Spring 2026?",
    description: "From research breakthroughs to athletics, campus expansions to partnerships — which story dominates the headlines?",
    close_at: daysFromNow(30),
    resolve_at: daysFromNow(100),
    resolution_criteria: "Resolves to the category with the most media impressions in stories mentioning Northeastern University between January and May 2026, based on news.northeastern.edu coverage volume by section.",
    outcomes: ["Research / Innovation breakthrough", "Major athletics achievement", "Campus expansion / construction", "Corporate or academic partnership"],
  },
  {
    category: "wildcard",
    title: "How large will Northeastern's Class of 2026 Commencement ceremony be?",
    description: "NU's graduating class has grown with global expansion. Will the 2026 ceremony set a new attendance record?",
    close_at: daysFromNow(90),
    resolve_at: daysFromNow(110),
    resolution_criteria: "Resolves to the attendance band matching Northeastern's official 2026 Spring Commencement participant count (degree recipients + guests) as reported in the commencement program or university communications.",
    outcomes: ["Under 5,000 participants", "5,000–7,500", "7,501–10,000", "Over 10,000"],
  },
];

/** Ensure the seed creator auth user exists; return a signed-in JWT. */
async function seedCreatorJwt(): Promise<string> {
  const existing = await pg<{ id: string }[]>(
    "GET",
    "/profiles",
    undefined,
    { select: "id", email: `eq.${SEED_CREATOR.email}`, limit: "1" },
  );

  if (existing.length === 0) {
    const res = await fetch(`${AUTH_BASE}/admin/users`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: SEED_CREATOR.email,
        password: SEED_CREATOR.password,
        email_confirm: true,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Auth create ${SEED_CREATOR.email} → ${res.status}: ${txt}`);
    }
    console.log(`Created seed creator ${SEED_CREATOR.email}.`);
  }

  const res = await fetch(`${AUTH_BASE}/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: SEED_CREATOR.email,
      password: SEED_CREATOR.password,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Sign-in ${SEED_CREATOR.email} → ${res.status}: ${txt}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function main() {
  const jwt = await seedCreatorJwt();

  // Check existing count to avoid re-seeding.
  const countRes = await fetch(`${BASE}/markets?select=id`, {
    headers: { ...HEADERS, Prefer: "count=exact" },
  });
  const existingCount = parseInt(countRes.headers.get("content-range")?.split("/")[1] ?? "0", 10);

  if (existingCount >= 60) {
    console.log(`Database already has ${existingCount} markets — skipping seed.`);
    process.exit(0);
  }

  const counts: Record<string, number> = {};
  const outcomeCounts: Record<number, number> = {};

  for (let i = 0; i < MARKETS.length; i++) {
    const m = MARKETS[i];
    const outcomes = m.outcomes ?? OUTCOME_SETS[i % OUTCOME_SETS.length];
    // Use explicit resolution criteria for named-outcome markets; auto-generate for generic sets.
    const criteria =
      m.outcomes
        ? m.resolution_criteria
        : outcomes.length > 2
          ? `Resolves to whichever of the listed outcomes occurs: ${outcomes.join(" / ")}.`
          : m.resolution_criteria;

    const res = await fetch(`${BASE}/rpc/create_market`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_title: m.title,
        p_description: m.description ?? null,
        p_category: m.category,
        p_resolution_criteria: criteria,
        p_close_at: m.close_at,
        p_resolve_at: m.resolve_at,
        p_outcomes: outcomes,
        p_catch_all: false,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`create_market "${m.title.slice(0, 50)}" → ${res.status}: ${text}`);
    }

    counts[m.category] = (counts[m.category] ?? 0) + 1;
    outcomeCounts[outcomes.length] = (outcomeCounts[outcomes.length] ?? 0) + 1;
  }

  console.log(`\nSeeded ${MARKETS.length} markets:`);
  for (const [cat, count] of Object.entries(counts).sort()) {
    console.log(`  ${cat.padEnd(12)} ${count}`);
  }
  console.log("\nOutcome-count mix:");
  for (const [n, count] of Object.entries(outcomeCounts).sort()) {
    console.log(`  ${n} outcomes: ${count}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
