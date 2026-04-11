import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), "..");
const indexPath = path.join(projectRoot, "index.html");
const penPath = path.join(projectRoot, "vuily.pen");
const watchedFiles = [
  indexPath,
  path.join(projectRoot, "script.js"),
  path.join(projectRoot, "styles.css"),
];

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function normalizeText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMatch(html, regex) {
  const match = html.match(regex);
  return match ? normalizeText(match[1]) : "";
}

function extractReservedPanelNote(html) {
  const panelMatch = html.match(
    /<article[^>]*class="[^"]*\bsaved-panel\b[^"]*"[^>]*>([\s\S]*?)<\/article>/i
  );
  if (!panelMatch) {
    return "";
  }
  return extractMatch(panelMatch[1], /<p[^>]*class="[^"]*\bpanel-note\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
}

function extractPanelTitle(html, panelClass) {
  return extractMatch(
    html,
    new RegExp(
      `<article[^>]*class="[^"]*\\b${panelClass}\\b[^"]*"[^>]*>[\\s\\S]*?<h2[^>]*>([\\s\\S]*?)<\\/h2>`,
      "i"
    )
  );
}

function extractTopMenuItems(html) {
  const navMatch = html.match(
    /<nav[^>]*class="[^"]*\btop-menu\b[^"]*"[^>]*>([\s\S]*?)<\/nav>/i
  );
  if (!navMatch) {
    return [];
  }
  const labels = [];
  const anchorRegex = /<a[^>]*class="[^"]*\bmenu-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let match = null;
  while ((match = anchorRegex.exec(navMatch[1])) !== null) {
    const label = normalizeText(match[1]);
    if (label) {
      labels.push(label);
    }
  }
  return labels;
}

function extractButtonTextById(html, buttonId) {
  return extractMatch(html, new RegExp(`<button[^>]*id="${buttonId}"[^>]*>([\\s\\S]*?)<\\/button>`, "i"));
}

function extractInputPlaceholderById(html, inputId) {
  const match = html.match(new RegExp(`<input[^>]*id="${inputId}"[^>]*placeholder="([^"]*)"[^>]*>`, "i"));
  return match ? normalizeText(match[1]) : "";
}

function buildPenModel(values) {
  const nowIso = new Date().toISOString();
  return {
    version: "2.9",
    children: [
      {
        type: "frame",
        id: "vuily_screen",
        x: 80,
        y: 80,
        name: `Vuily SF Events • Synced ${nowIso}`,
        width: 1360,
        height: 1220,
        fill: "#FFF7DE",
        cornerRadius: 24,
        layout: "vertical",
        gap: 16,
        padding: 24,
        children: [
          {
            type: "frame",
            id: "top_row",
            width: "fill_container",
            justifyContent: "space_between",
            alignItems: "center",
            children: [
              {
                type: "text",
                id: "brand",
                fill: "#1F2240",
                content: values.brand || "Vuily",
                fontFamily: "Baloo 2",
                fontSize: 44,
                fontWeight: "800",
              },
              {
                type: "frame",
                id: "mood_chip",
                fill: "#2BA2E8",
                cornerRadius: 999,
                padding: [10, 16],
                children: [
                  {
                    type: "text",
                    id: "mood_text",
                    fill: "#FFFFFF",
                    content: values.moodText || "Mood: Curious + Adventurous",
                    fontFamily: "Nunito",
                    fontSize: 18,
                    fontWeight: "800",
                  },
                ],
              },
            ],
          },
          {
            type: "frame",
            id: "hero",
            width: "fill_container",
            fill: "#FFFFFFCC",
            cornerRadius: 20,
            layout: "vertical",
            gap: 8,
            padding: 20,
            children: [
              {
                type: "text",
                id: "eyebrow",
                fill: "#0E9E92",
                content: values.eyebrow || "SAN FRANCISCO ADULTS-ONLY EVENT EXPLORER",
                fontFamily: "Nunito",
                fontSize: 13,
                fontWeight: "800",
              },
              {
                type: "text",
                id: "hero_title",
                fill: "#1F2240",
                textGrowth: "fixed-width",
                width: "fill_container",
                content: values.heroTitle || "Swipe into your next fun night.",
                lineHeight: 0.95,
                fontFamily: "Baloo 2",
                fontSize: 54,
                fontWeight: "800",
              },
              {
                type: "text",
                id: "hero_desc",
                fill: "#596087",
                textGrowth: "fixed-width",
                width: "fill_container",
                content:
                  values.heroDesc ||
                  "Explore cultural, arts, music, and outdoors activities. Swipe left to pass, swipe right to reserve, then add plans to your calendar.",
                lineHeight: 1.35,
                fontFamily: "Nunito",
                fontSize: 20,
                fontWeight: "700",
              },
              {
                type: "text",
                id: "last_updated",
                fill: "#4F5C92",
                content: values.lastUpdated || "Last updated: waiting for live feed...",
                fontFamily: "Nunito",
                fontSize: 14,
                fontWeight: "700",
              },
            ],
          },
          {
            type: "frame",
            id: "top_menu",
            width: "fill_container",
            gap: 10,
            children: (values.menuItems?.length ? values.menuItems : ["Game Board", "Reserved Plans", "Weekly Compass"]).map(
              (item, index) => ({
                type: "frame",
                id: `menu_item_${index + 1}`,
                fill: index === 0 ? "#4D8DFF" : "#FFFFFF",
                stroke: index === 0 ? undefined : "#D7DFEF",
                cornerRadius: 999,
                padding: [8, 14],
                children: [
                  {
                    type: "text",
                    id: `menu_label_${index + 1}`,
                    fill: index === 0 ? "#FFFFFF" : "#1F2240",
                    content: item,
                    fontFamily: "Nunito",
                    fontSize: 14,
                    fontWeight: "800",
                  },
                ],
              })
            ),
          },
          {
            type: "frame",
            id: "dashboard",
            width: "fill_container",
            gap: 16,
            children: [
              {
                type: "frame",
                id: "score_panel",
                width: "fill_container",
                fill: "#FFFFFFE0",
                cornerRadius: 18,
                layout: "vertical",
                gap: 10,
                padding: 16,
                children: [
                  {
                    type: "text",
                    id: "score_title",
                    fill: "#1F2240",
                    content: values.scoreTitle || "Game Board",
                    fontFamily: "Baloo 2",
                    fontSize: 32,
                    fontWeight: "800",
                  },
                  {
                    type: "text",
                    id: "score_fields",
                    fill: "#596087",
                    textGrowth: "fixed-width",
                    width: "fill_container",
                    content: "Points: 0   •   Streak: 0   •   Level: Explorer",
                    fontFamily: "Nunito",
                    fontSize: 16,
                    fontWeight: "700",
                  },
                  {
                    type: "text",
                    id: "badge_text",
                    fill: "#FFFFFF",
                    content: "Badge: Newcomer",
                    fontFamily: "Nunito",
                    fontSize: 15,
                    fontWeight: "800",
                  },
                ],
              },
              {
                type: "frame",
                id: "filter_panel",
                width: "fill_container",
                fill: "#FFFFFFE0",
                cornerRadius: 18,
                layout: "vertical",
                gap: 10,
                padding: 16,
                children: [
                  {
                    type: "text",
                    id: "filter_title",
                    fill: "#1F2240",
                    content: values.filterTitle || "Pick Your Vibe",
                    fontFamily: "Baloo 2",
                    fontSize: 32,
                    fontWeight: "800",
                  },
                  {
                    type: "text",
                    id: "filter_fields",
                    fill: "#596087",
                    textGrowth: "fixed-width",
                    width: "fill_container",
                    content: "Category: All   •   Cost: Any Price",
                    fontFamily: "Nunito",
                    fontSize: 16,
                    fontWeight: "700",
                  },
                ],
              },
            ],
          },
          {
            type: "frame",
            id: "content",
            width: "fill_container",
            gap: 16,
            children: [
              {
                type: "frame",
                id: "swipe_panel",
                width: "fill_container",
                fill: "#FFFFFFE0",
                cornerRadius: 18,
                layout: "vertical",
                gap: 10,
                padding: 16,
                children: [
                  {
                    type: "text",
                    id: "swipe_title",
                    fill: "#1F2240",
                    content: values.swipeTitle || "Event Deck",
                    fontFamily: "Baloo 2",
                    fontSize: 32,
                    fontWeight: "800",
                  },
                  {
                    type: "text",
                    id: "swipe_note",
                    fill: "#596087",
                    textGrowth: "fixed-width",
                    width: "fill_container",
                    content: values.swipeNote || "Swipe left to pass. Swipe right to reserve your spot.",
                    fontFamily: "Nunito",
                    fontSize: 18,
                    fontWeight: "700",
                  },
                  {
                    type: "text",
                    id: "swipe_buttons",
                    fill: "#20486D",
                    textGrowth: "fixed-width",
                    width: "fill_container",
                    content: `${values.skipButton || "Skip Left"}  |  ${values.reserveButton || "Reserve Right"}`,
                    fontFamily: "Nunito",
                    fontSize: 16,
                    fontWeight: "800",
                  },
                ],
              },
              {
                type: "frame",
                id: "saved_panel",
                width: "fill_container",
                fill: "#FFFFFFE0",
                cornerRadius: 18,
                layout: "vertical",
                gap: 10,
                padding: 16,
                children: [
                  {
                    type: "text",
                    id: "saved_title",
                    fill: "#1F2240",
                    content: values.savedTitle || "Reserved Plans",
                    fontFamily: "Baloo 2",
                    fontSize: 32,
                    fontWeight: "800",
                  },
                  {
                    type: "text",
                    id: "saved_note",
                    fill: "#596087",
                    textGrowth: "fixed-width",
                    width: "fill_container",
                    content: values.savedNote || "Add events to your calendar and rate them after you go.",
                    fontFamily: "Nunito",
                    fontSize: 18,
                    fontWeight: "700",
                  },
                  {
                    type: "text",
                    id: "saved_controls",
                    fill: "#596087",
                    textGrowth: "fixed-width",
                    width: "fill_container",
                    content: `Search: ${values.savedSearchPlaceholder || "Search reserved plans"}  •  Category: ${
                      values.savedCategoryDefault || "All Categories"
                    }`,
                    fontFamily: "Nunito",
                    fontSize: 15,
                    fontWeight: "700",
                  },
                  {
                    type: "text",
                    id: "saved_placeholder",
                    fill: "#596087",
                    textGrowth: "fixed-width",
                    width: "fill_container",
                    content: "Reserved event cards render here (5 per page with pagination).",
                    fontFamily: "Nunito",
                    fontSize: 14,
                    fontWeight: "700",
                  },
                ],
              },
            ],
          },
          {
            type: "frame",
            id: "weekly_compass_panel",
            width: "fill_container",
            fill: "#FFFFFFE0",
            cornerRadius: 18,
            layout: "vertical",
            gap: 10,
            padding: 16,
            children: [
              {
                type: "text",
                id: "weekly_title",
                fill: "#1F2240",
                content: values.weeklyTitle || "This Week's Event Compass",
                fontFamily: "Baloo 2",
                fontSize: 32,
                fontWeight: "800",
              },
              {
                type: "text",
                id: "weekly_filter",
                fill: "#596087",
                textGrowth: "fixed-width",
                width: "fill_container",
                content: values.weeklyFilter || "Calendar Categories: All (multi-select)",
                fontFamily: "Nunito",
                fontSize: 15,
                fontWeight: "700",
              },
              {
                type: "text",
                id: "weekly_note",
                fill: "#596087",
                textGrowth: "fixed-width",
                width: "fill_container",
                content:
                  values.weeklySummary ||
                  "A 7-day calendar appears here with event links, categories, and expandable day sections.",
                fontFamily: "Nunito",
                fontSize: 14,
                fontWeight: "700",
              },
            ],
          },
        ],
      },
    ],
  };
}

function syncPen() {
  const html = readFile(indexPath);
  const savedCategoryDefault =
    extractMatch(
      html,
      /<select[^>]*id="savedCategoryFilter"[^>]*>[\s\S]*?<option[^>]*>([\s\S]*?)<\/option>/i
    ) || "All Categories";
  const values = {
    brand: extractMatch(html, /<a[^>]*class="[^"]*\bbrand\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i),
    moodText: extractMatch(html, /<div[^>]*class="[^"]*\bstat-chip\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i),
    eyebrow: extractMatch(html, /<p[^>]*class="[^"]*\beyebrow\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i),
    heroTitle: extractMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
    heroDesc: extractMatch(html, /<p[^>]*class="[^"]*\bhero-text\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i),
    lastUpdated: extractMatch(html, /<p[^>]*id="lastUpdated"[^>]*>([\s\S]*?)<\/p>/i),
    scoreTitle: extractPanelTitle(html, "score-panel"),
    filterTitle: extractPanelTitle(html, "filter-panel"),
    swipeTitle: extractPanelTitle(html, "swipe-panel"),
    swipeNote: extractMatch(html, /<p[^>]*class="[^"]*\bswipe-help\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i),
    savedTitle: extractPanelTitle(html, "saved-panel"),
    savedNote: extractReservedPanelNote(html),
    skipButton: extractButtonTextById(html, "skipBtn"),
    reserveButton: extractButtonTextById(html, "reserveBtn"),
    savedSearchPlaceholder: extractInputPlaceholderById(html, "savedSearch"),
    savedCategoryDefault,
    menuItems: extractTopMenuItems(html),
    weeklyTitle: extractMatch(html, /<h2[^>]*id="weekCalendarTitle"[^>]*>([\s\S]*?)<\/h2>/i),
    weeklySummary: extractMatch(html, /<p[^>]*id="weekCalendarSummary"[^>]*>([\s\S]*?)<\/p>/i),
    weeklyFilter: extractMatch(html, /<label>\s*Calendar Categories\s*<\/label>/i)
      ? "Calendar Categories: All (multi-select)"
      : "",
  };

  const pen = buildPenModel(values);

  fs.writeFileSync(penPath, `${JSON.stringify(pen, null, 2)}\n`);
  console.log(`[sync-pen] Updated ${path.basename(penPath)} at ${new Date().toLocaleString()}`);
}

function watchMode() {
  let timer = null;
  const scheduleSync = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      try {
        syncPen();
      } catch (error) {
        console.error("[sync-pen] Sync failed:", error);
      }
    }, 180);
  };

  const watchers = watchedFiles.map((file) =>
    fs.watch(file, () => {
      scheduleSync();
    })
  );

  console.log("[sync-pen] Watching index.html, script.js, and styles.css for changes...");
  syncPen();

  process.on("SIGINT", () => {
    watchers.forEach((watcher) => watcher.close());
    console.log("\n[sync-pen] Stopped watcher.");
    process.exit(0);
  });
}

if (process.argv.includes("--once")) {
  syncPen();
} else {
  watchMode();
}
