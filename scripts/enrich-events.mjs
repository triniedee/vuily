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
 *   axes:         five numeric scores (0–10)
 *     formality   — how professional/formal the social norms feel
 *     energy      — pace and stimulation of the setting
 *     pressure    — how evaluated/observed attendees feel
 *     ambiguity   — uncertainty about what to expect or do
 *     intimacy    — depth of connection the space enables
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

// ─── Live source parsers ──────────────────────────────────────────────────────

function parseRss(xml) {
  const items = [];
  const matches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  for (const item of matches) {
    const get = (tag) => {
      const m = item.match(new RegExp(`<${tag}(?:[^>]*)>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };
    items.push({ title: get("title"), link: get("link"), pubDate: get("pubDate"), description: get("description") });
  }
  return items;
}

function parse19hz(html, now) {
  const events = [];
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  for (const row of rows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    if (cells.length < 2) continue;
    const strip = s => s.replace(/<[^>]*>/g, "").trim();
    const title = strip(cells[1] || "");
    if (!title || title.length < 3) continue;
    const ymdMatch = row.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
    if (!ymdMatch) continue;
    const date = new Date(`${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`);
    if (isNaN(date.getTime()) || date < now) continue;
    const hrefMatch = (cells[1] || "").match(/href=['"]([^'"]+)['"]/i);
    const url = hrefMatch ? hrefMatch[1] : "";
    const venueSplit = title.split(" @ ");
    const location = venueSplit.length > 1 ? venueSplit.slice(1).join(" @ ").trim() : "San Francisco";
    const tags = strip(cells[2] || "");
    const cleanTitle = venueSplit[0].trim();
    const id = `19hz-${(url || cleanTitle).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}`;
    events.push({ id, title: cleanTitle, date: date.toISOString(), url, location, source: "19hz", cost: "Check site", description: tags });
  }
  return events;
}

function parseJsonLd(html) {
  const events = [];
  const matches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of matches) {
    try {
      const json = block.replace(/<script[^>]*>|<\/script>/gi, "").trim();
      const data = JSON.parse(json);
      const items = Array.isArray(data) ? data : (data["@graph"] ? data["@graph"] : [data]);
      for (const item of items) {
        const type = item["@type"];
        if (type === "Event" || (Array.isArray(type) && type.includes("Event"))) events.push(item);
      }
    } catch {}
  }
  return events;
}

function mapJsonLdEvent(item, source, prefix, now) {
  const title = (item.name || "").trim();
  if (!title) return null;
  const date = new Date(item.startDate);
  if (isNaN(date.getTime()) || date < now) return null;
  const loc = item.location;
  const location =
    typeof loc === "string" ? loc :
    loc?.address?.streetAddress ? [loc.address.streetAddress, loc.address.addressLocality].filter(Boolean).join(", ") :
    loc?.name || "San Francisco";
  const url = item.url || item["@id"] || "";
  const description = stripHtml(item.description || "").slice(0, 400);
  const price = item.offers?.price ?? item.offers?.[0]?.price;
  const cost = (price === 0 || price === "0") ? "Free" : price ? `$${price}` : "Check site";
  const id = `${prefix}-${(url || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}`;
  return { id, title, date: date.toISOString(), location, url, source, cost, description };
}

// ─── Fetch live sources ───────────────────────────────────────────────────────

async function fetchLiveSources() {
  const now = new Date();
  const events = [];
  const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  await Promise.allSettled([
    // SF Funcheap RSS (via Feedburner to avoid redirect issues)
    fetch("https://feeds.feedburner.com/funcheapsf_recent_added_events/", { headers: { "User-Agent": BROWSER_UA } })
      .then(r => r.ok ? r.text() : "")
      .then(xml => {
        const items = parseRss(xml);
        let count = 0;
        for (const item of items) {
          const rawTitle = stripHtml(item.title || "").trim();
          if (!rawTitle) continue;
          // Funcheap titles embed event date: "5/2/26: Event Name - FREE"
          const dateMatch = rawTitle.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4}):/);
          let date = null;
          let title = rawTitle;
          if (dateMatch) {
            date = new Date(dateMatch[1]);
            title = rawTitle.slice(dateMatch[0].length).trim().replace(/\s*-\s*FREE\s*$/i, "").trim();
          } else {
            date = item.pubDate ? new Date(item.pubDate) : null;
          }
          if (!date || isNaN(date.getTime()) || date < now) continue;
          const id = `funcheap-${(item.link || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}`;
          events.push({ id, title, date: date.toISOString(), url: item.link || "", location: "San Francisco", source: "SF Funcheap", cost: "Free", description: stripHtml(item.description || "").slice(0, 400) });
          count++;
        }
        console.log(`[funcheap] ${count} events`);
      })
      .catch(e => console.warn("[funcheap] failed:", e.message)),

    // 19hz Bay Area
    fetch("https://19hz.info/eventlisting_BayArea.php", { headers: { "User-Agent": BROWSER_UA } })
      .then(r => r.ok ? r.text() : "")
      .then(html => {
        const items = parse19hz(html, now);
        events.push(...items);
        console.log(`[19hz] ${items.length} events`);
      })
      .catch(e => console.warn("[19hz] failed:", e.message)),

    // Meetup SF
    fetch("https://www.meetup.com/find/?location=us--ca--san+francisco&source=EVENTS", {
      headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }
    })
      .then(r => r.ok ? r.text() : "")
      .then(html => {
        const items = parseJsonLd(html).map(e => mapJsonLdEvent(e, "Meetup", "meetup", now)).filter(Boolean);
        events.push(...items);
        console.log(`[meetup] ${items.length} events`);
      })
      .catch(e => console.warn("[meetup] failed:", e.message)),
  ]);

  // Dedupe by id
  const seen = new Set();
  return events.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
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
  "uniqueness": 0.0 to 1.0,
  "axes": {
    "formality": 0-10,
    "energy": 0-10,
    "pressure": 0-10,
    "ambiguity": 0-10,
    "intimacy": 0-10
  }
}

Axis guidance:
- formality: 0=barefoot beach party, 10=black-tie gala
- energy: 0=silent meditation, 10=front row at a loud concert
- pressure: 0=anonymous in a crowd, 10=presenting at a job interview
- ambiguity: 0=scripted tour with clear agenda, 10=no description, just show up
- intimacy: 0=stadium crowd, 10=one-on-one conversation over wine`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
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

  // Fetch events from all sources
  const [apifyEvents, liveEvents] = await Promise.all([fetchAllEvents(), fetchLiveSources()]);

  // Merge, preferring Apify events (already deduped by id)
  const apifyIds = new Set(apifyEvents.map(e => e.id));
  const newLive = liveEvents.filter(e => !apifyIds.has(e.id));
  const events = [...apifyEvents, ...newLive];
  console.log(`Fetched ${apifyEvents.length} Apify + ${newLive.length} live = ${events.length} total future events`);

  // Enrich — skip events already cached with full 5-axis scores
  const toEnrich = events.filter((e) => !cache[e.id] || !cache[e.id].axes);
  console.log(`Enriching ${toEnrich.length} events via Claude Haiku (${events.length - toEnrich.length} already cached)...`);

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

    // Rate limit: 2 concurrent + 2.5s delay = ~48 req/min, under 50/min limit
    await new Promise((r) => setTimeout(r, 2500));
  }

  console.log(`Enrichment complete: ${enriched} new, ${failed} failed, ${Object.keys(cache).length} total cached`);

  console.log(`Wrote ${events.length} events to ${DATA_FILE}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
