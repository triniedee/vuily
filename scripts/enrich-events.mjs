/**
 * Vuily Serendipity Engine — Event Enrichment Script
 *
 * Fetches all Apify datasets, calls Claude Haiku to extract context signatures
 * for each event, and writes enriched-events.json to data/.
 *
 * Signatures extracted per event:
 *   energy:       calm | moderate | high
 *   social_shape: solo | duo | small_group | crowd
 *   spontaneity:  planned | drop-in
 *   vibe:         up to 3 of [intellectual, playful, romantic, adventurous, chill, electric, weird, cozy]
 *   uniqueness:   0.0–1.0
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../data/enriched-events.json");

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!APIFY_TOKEN) { console.error("Missing APIFY_TOKEN"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("Missing ANTHROPIC_API_KEY"); process.exit(1); }

const DATASETS = [
  { id: "cFEcLNFCjkaNd0Dci", type: "eventbrite" },
  { id: "rF4QswDVxXtzbuVPl", type: "eventbrite" },
  { id: "z7sA6wzx3DF8w6Zhx", type: "luma" },
  { id: "5XkgHAs8QoMP4sUe6", type: "google" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(str) {
  return String(str || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapEventbrite(item, i) {
  const title = stripHtml(item.title || item.name || "").trim();
  if (!title) return null;
  let dateStr;
  if (item.startDate && typeof item.startDate === "object") {
    dateStr = item.startDate.local || item.startDate.utc;
  } else {
    dateStr = item.startDate ? `${item.startDate}T${item.startTime || "00:00:00"}` : null;
  }
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime()) || date < new Date()) return null;
  const venue = item.venue?.fullAddress ||
    [item.venue?.name, item.venue?.streetAddress, item.venue?.city, item.venue?.state].filter(Boolean).join(", ");
  return {
    id: `eventbrite-${item.id || i}`,
    title,
    description: stripHtml(item.description || item.summary || "").slice(0, 400),
    date: date.toISOString(),
    location: venue || "San Francisco",
    url: item.url || "",
    source: "Eventbrite",
    cost: (item.pricing?.isFree || item.isFree) ? "Free" : "Check site",
  };
}

function mapLuma(item, i) {
  const title = stripHtml(item.name || "").trim();
  if (!title) return null;
  if (!item.startAt) return null;
  const date = new Date(item.startAt);
  if (isNaN(date.getTime()) || date < new Date()) return null;
  if (item.location?.locationType === "online") return null;
  const venue = item.location?.fullAddress || item.location?.address ||
    [item.location?.city, item.location?.region].filter(Boolean).join(", ") || "San Francisco";
  return {
    id: `luma-${item.id || i}`,
    title,
    description: stripHtml(item.description || "").slice(0, 400),
    date: date.toISOString(),
    location: venue,
    url: item.lumaUrl || "",
    source: "Luma",
    cost: item.ticketing?.isFree ? "Free" : item.ticketing?.priceCents ? `$${(item.ticketing.priceCents / 100).toFixed(0)}` : "Check site",
  };
}

function mapGoogle(event, i) {
  const title = (event.title || "").trim();
  if (!title) return null;
  const startDateStr = event.date?.start_date;
  if (!startDateStr) return null;
  let date = new Date(`${startDateStr}, ${new Date().getFullYear()}`);
  const when = event.date?.when || "";
  const timeMatch = when.match(/(\d+(?::\d+)?)\s*(AM|PM)/i);
  if (timeMatch && !isNaN(date.getTime())) {
    let [, timePart, ampm] = timeMatch;
    let [hours, mins] = timePart.split(":").map(Number);
    if (ampm.toUpperCase() === "PM" && hours !== 12) hours += 12;
    if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
    date.setHours(hours, mins || 0, 0, 0);
  }
  if (isNaN(date.getTime()) || date < new Date()) return null;
  const address = Array.isArray(event.address) ? event.address.join(", ") : (event.address || "San Francisco");
  return {
    id: `google-${i}`,
    title,
    description: stripHtml(event.description || "").slice(0, 400),
    date: date.toISOString(),
    location: address,
    url: event.link || "",
    source: "Google Events",
    cost: "Check site",
  };
}

// ─── Fetch all events ─────────────────────────────────────────────────────────

async function fetchAllEvents() {
  const events = [];

  for (const { id, type } of DATASETS) {
    try {
      const url = `https://api.apify.com/v2/datasets/${id}/items?token=${APIFY_TOKEN}&format=json&clean=true&limit=1000`;
      const items = await fetchJson(url);
      console.log(`[${type}] ${id}: ${items.length} raw items`);

      if (type === "google") {
        const googleEvents = items.flatMap((page) => page.events || []);
        googleEvents.forEach((e, i) => {
          const mapped = mapGoogle(e, i);
          if (mapped) events.push(mapped);
        });
      } else if (type === "eventbrite") {
        items.forEach((item, i) => {
          const mapped = mapEventbrite(item, i);
          if (mapped) events.push(mapped);
        });
      } else if (type === "luma") {
        items.forEach((item, i) => {
          const mapped = mapLuma(item, i);
          if (mapped) events.push(mapped);
        });
      }
    } catch (err) {
      console.warn(`[${type}] ${id} failed:`, err.message);
    }
  }

  // Dedupe by id
  const seen = new Set();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

// ─── Claude Haiku enrichment ──────────────────────────────────────────────────

async function enrichEvent(event) {
  const prompt = `You are extracting context signatures from an SF event for a serendipity engine. Return ONLY valid JSON, no explanation.

Event: "${event.title}"
Description: "${event.description || "none"}"
Location: "${event.location}"

Return this exact JSON structure:
{
  "energy": "calm" | "moderate" | "high",
  "social_shape": "solo" | "duo" | "small_group" | "crowd",
  "spontaneity": "planned" | "drop-in",
  "vibe": [up to 3 from: "intellectual", "playful", "romantic", "adventurous", "chill", "electric", "weird", "cozy"],
  "uniqueness": 0.0 to 1.0
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    return JSON.parse(jsonMatch[0]);
  } catch {
    console.warn(`[enrich] Failed to parse signature for "${event.title}":`, text);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Vuily Event Enrichment ===");

  // Load existing cache
  let cache = {};
  if (fs.existsSync(DATA_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      existing.forEach((e) => {
        if (e.id && e.signature) cache[e.id] = e.signature;
      });
      console.log(`Loaded ${Object.keys(cache).length} cached signatures`);
    } catch {
      console.warn("Could not load existing cache, starting fresh");
    }
  }

  // Fetch events
  const events = await fetchAllEvents();
  console.log(`Fetched ${events.length} future events total`);

  // Enrich — skip events already cached
  const toEnrich = events.filter((e) => !cache[e.id]);
  console.log(`Enriching ${toEnrich.length} new events via Claude Haiku...`);

  let enriched = 0;
  let failed = 0;
  const CONCURRENCY = 2; // stay under 50 req/min rate limit
  const SAVE_EVERY = 25;

  function saveProgress() {
    const output = events.map((e) => ({ ...e, signature: cache[e.id] || null }));
    fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2));
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < toEnrich.length; i += CONCURRENCY) {
    const batch = toEnrich.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (event) => {
      try {
        const signature = await enrichEvent(event);
        if (signature) {
          cache[event.id] = signature;
          enriched++;
        } else {
          failed++;
        }
      } catch (err) {
        console.warn(`  Failed to enrich "${event.title}":`, err.message);
        failed++;
      }
    }));

    const total = enriched + failed;
    if (total % SAVE_EVERY === 0 || i + CONCURRENCY >= toEnrich.length) {
      saveProgress();
      console.log(`  ${total}/${toEnrich.length} processed (${enriched} enriched, ${failed} failed)...`);
    }

    // Rate limit: 2 concurrent + 1.5s delay = ~80 req/min, under 50/min limit
    await new Promise((r) => setTimeout(r, 2500));
  }

  console.log(`Enrichment complete: ${enriched} new, ${failed} failed, ${Object.keys(cache).length} total cached`);

  console.log(`Wrote ${events.length} events to ${DATA_FILE}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
