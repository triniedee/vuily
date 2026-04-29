import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are Vuily's serendipity agent for San Francisco. Your job is to find one perfect unexpected event for someone tonight or this weekend.

Ask 2-3 short, fun questions to understand what they're feeling, then use search_events to find matches and recommend ONE event.

Keep questions light and conversational — one at a time. Don't ask more than 3 questions before picking something. After you have enough to go on, use the tool and commit to a recommendation.

For your final recommendation, write a 2-3 sentence pitch in SECOND-PERSON PRESENT TENSE — put the person physically in the scene as if they've already walked in. Lead with the first thing they'd sense: the sound hitting them, the light, the crowd. Be specific and visceral, not generic. Do not describe the event from the outside.

Good: "You slip in just as the lights drop — the whole room pivots at once. It's a Thursday crowd that actually came to listen, not be seen."
Bad: "This is a great jazz event at a cozy venue in the Mission."

Then on a new line at the very end, write exactly this (fill in real values — energy must be calm, moderate, or high; vibe is an array of 1-3 tags; copy axes exactly from the event data if present, otherwise omit the axes key; no extra text after):
PICK:{"title":"...","date":"...","location":"...","cost":"...","url":"...","energy":"calm|moderate|high","vibe":["..."],"axes":{"formality":N,"energy":N,"pressure":N,"ambiguity":N,"intimacy":N}}

Current SF time: ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}.`;

const TOOLS = [
  {
    name: "search_events",
    description: "Search Vuily's SF event database for events matching the user's vibe.",
    input_schema: {
      type: "object",
      properties: {
        energy: { type: "string", enum: ["calm", "moderate", "high"] },
        social_shape: { type: "string", enum: ["solo", "duo", "small_group", "crowd"] },
        vibes: { type: "array", items: { type: "string", enum: ["intellectual", "playful", "romantic", "adventurous", "chill", "electric", "weird", "cozy"] } },
        max_results: { type: "number" },
      },
      required: [],
    },
  },
];

function loadEvents() {
  try {
    const file = path.join(process.cwd(), "data/enriched-events.json");
    const all = JSON.parse(fs.readFileSync(file, "utf8"));
    const now = new Date();
    return all.filter(e => e && e.date && new Date(e.date) > now && e.source !== "Luma");
  } catch {
    return [];
  }
}

function searchEvents({ energy, social_shape, vibes = [], max_results = 8 }) {
  let events = loadEvents();
  if (energy) events = events.filter(e => !e.signature || e.signature.energy === energy);
  if (social_shape) events = events.filter(e => !e.signature || e.signature.social_shape === social_shape);
  if (vibes.length) events = events.filter(e => e.signature?.vibe?.some(v => vibes.includes(v)));
  events.sort((a, b) => (b.signature?.uniqueness ?? 0.5) - (a.signature?.uniqueness ?? 0.5));
  return events.slice(0, max_results).map(e => ({
    title: e.title,
    date: e.date,
    location: e.location,
    cost: e.cost,
    description: e.description,
    url: e.url,
    source: e.source,
    vibe: e.signature?.vibe,
    energy: e.signature?.energy,
    axes: e.signature?.axes ?? null,
  }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { messages } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  function emit(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    let currentMessages = messages;

    for (let i = 0; i < 3; i++) {
      const stream = client.messages.stream({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM,
        tools: TOOLS,
        messages: currentMessages,
      });

      stream.on("text", (text) => {
        emit("token", { text });
      });

      const finalMessage = await stream.finalMessage();

      if (finalMessage.stop_reason !== "tool_use") {
        emit("done", {});
        res.end();
        return;
      }

      const toolUse = finalMessage.content.find(b => b.type === "tool_use");
      emit("tool_start", { energy: toolUse.input.energy, vibes: toolUse.input.vibes || [] });

      const results = searchEvents(toolUse.input);
      emit("tool_result", { count: results.length });

      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: finalMessage.content },
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(results) }],
        },
      ];
    }

    emit("error", { message: "Agent loop exceeded" });
    res.end();
  } catch (err) {
    console.error("[agent]", err);
    emit("error", { message: err.message });
    res.end();
  }
}
