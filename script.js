const SFFUNCHEAP_FEED_URL = "https://sf.funcheap.com/feed/";
const SFFUNCHEAP_FEEDBACKUP_URL =
  "https://feeds.feedburner.com/funcheapsf_recent_added_events/";
const SFFUNCHEAP_MAX_PAGES = 10;
const SFFUNCHEAP_RSS_URLS = [SFFUNCHEAP_FEEDBACKUP_URL, SFFUNCHEAP_FEED_URL];
const NINETEENHZ_URL = "https://19hz.info/eventlisting_BayArea.php";
const CITY_COUNTY_LOOKUP_URL = "./city_county_lookup.json";
const POSH_SITEMAP_RECENT_URL = "https://posh.vip/sitemap-events-recent.xml";
const POSH_DISCOVERY_MAX_URLS = 260;
const POSH_VALIDATION_MAX_URLS = 120;
const POSH_BAY_AREA_EVENT_URLS = [
  "https://posh.vip/e/beso-sf-44",
  "https://posh.vip/e/frnds-only-san-francisco-0411",
  "https://posh.vip/e/mehaber-oakland-edition",
  "https://posh.vip/e/perreo-rosado-pink-party-temple-nightclub-san-francisco",
  "https://posh.vip/e/pianoafterdark-oakland",
  "https://posh.vip/e/startup-art-fair-san-francisco-2026",
  "https://posh.vip/e/morten-at-madarae-san-francisco",
  "https://posh.vip/e/one-night-in-jozi-oakland-1",
  "https://posh.vip/e/one-big-rb-day-party-oaklands-biggest-day-party",
  "https://posh.vip/e/mina-flow-state-tour-oaklandca",
  "https://posh.vip/e/chai-beats-san-francisco",
  "https://posh.vip/e/elevate-shabbat-presents-come-together-san-francisco",
  "https://posh.vip/e/curious-hour-oakland",
  "https://posh.vip/e/1st-gen-berkeley",
  "https://posh.vip/e/halfdays-san-francisco-walk",
  "https://posh.vip/e/san-jose-welcome-week-rave-rsvp-only-1",
  "https://posh.vip/e/san-francisco-welcome-week-rave-rsvp-only",
  "https://posh.vip/e/berkeley-welcome-week-rave-rsvp-only-1",
  "https://posh.vip/e/familiar-faces-day-party-san-francisco-3",
  "https://posh.vip/e/little-mania-all-stars-san-jose-ca-ages-18-april-23",
  "https://posh.vip/e/dil-se-rave-audiosf",
  "https://posh.vip/e/anna-luna-x-ren-g",
];
const ALLORIGINS_RAW_BASE_URL = "https://api.allorigins.win/raw?url=";
const MEETUP_SF_URL = "https://www.meetup.com/find/?location=San+Francisco%2C+CA&source=EVENTS&distance=fiveMiles";
const EVENTBRITE_SF_URL = "https://www.eventbrite.com/d/ca--san-francisco/events/";
const TIMEOUT_SF_URL = "https://www.timeout.com/san-francisco/things-to-do";
const SFFUNCHEAP_LISTING_URLS = [
  "https://sf.funcheap.com/events/today/",
  "https://sf.funcheap.com/events/tomorrow/",
  "https://sf.funcheap.com/events/weekend/",
];
const LOCAL_FALLBACK_EVENTS = [
  {
    title: "Sunset Jazz on the Embarcadero",
    category: "Music",
    cost: "Free",
    location: "Embarcadero Plaza, San Francisco",
    description:
      "Outdoor live jazz with local artists and waterfront sunset views. Bring a blanket and enjoy the evening vibe.",
  },
  {
    title: "North Beach Comedy Night",
    category: "Cultural",
    cost: "Budget",
    location: "North Beach Social Club, San Francisco",
    description:
      "Stand-up comedy showcase featuring Bay Area comics in an intimate neighborhood venue.",
  },
  {
    title: "Golden Gate Park Art Walk",
    category: "Arts",
    cost: "Free",
    location: "Golden Gate Park, San Francisco",
    description:
      "A guided public art walk through installations and murals with community artists.",
  },
  {
    title: "Mission District Food Pop-Up",
    category: "Cultural",
    cost: "Moderate",
    location: "Valencia St, San Francisco",
    description:
      "Sample rotating food vendors, local makers, and live acoustic sets in the Mission.",
  },
  {
    title: "Presidio Evening Hike Meetup",
    category: "Outdoors",
    cost: "Free",
    location: "Presidio Tunnel Tops, San Francisco",
    description:
      "Casual sunset group hike with scenic overlooks and a friendly social meetup after.",
  },
];
let cityCountyLookup = {};
let cityLookupEntries = [];
let cityLookupReady = false;
let poshSlugKeywords = [];

function buildProxyUrl(url) {
  return `/proxy?url=${encodeURIComponent(url)}`;
}

function buildAllOriginsUrl(url) {
  return `${ALLORIGINS_RAW_BASE_URL}${encodeURIComponent(url)}`;
}

async function fetchTextWithProxyFallback(targetUrl, label = "Request") {
  const proxyUrl = buildProxyUrl(targetUrl);
  try {
    const proxyResponse = await fetch(proxyUrl, { cache: "no-store" });
    if (proxyResponse.ok) {
      return await proxyResponse.text();
    }
    console.warn(`[proxy] ${label} failed via /proxy`, proxyResponse.status, targetUrl);
  } catch (error) {
    console.warn(`[proxy] ${label} /proxy network error`, targetUrl, error);
  }

  const fallbackUrl = buildAllOriginsUrl(targetUrl);
  const fallbackResponse = await fetch(fallbackUrl, { cache: "no-store" });
  if (!fallbackResponse.ok) {
    throw new Error(`${label} failed (${fallbackResponse.status})`);
  }
  return await fallbackResponse.text();
}

function normalizeLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildCityLookupIndex(lookup) {
  cityCountyLookup = lookup || {};
  cityLookupEntries = Object.values(cityCountyLookup)
    .map((entry) => ({
      cityName: entry.name || "",
      normalized: normalizeLookupText(entry.name || ""),
      urbanClassification: entry.urbanClassification || "",
      county: entry.county || "",
    }))
    .filter((entry) => entry.normalized)
    .sort((a, b) => b.normalized.length - a.normalized.length);

  const keywordSet = new Set();
  for (const entry of cityLookupEntries) {
    const slug = entry.normalized.replace(/\s+/g, "-");
    if (slug.length >= 4) {
      keywordSet.add(slug);
    }
    const compact = entry.normalized.replace(/\s+/g, "");
    if (compact.length >= 6) {
      keywordSet.add(compact);
    }
  }
  poshSlugKeywords = [...keywordSet].sort((a, b) => b.length - a.length);
}

async function loadCityCountyLookup() {
  if (cityLookupReady) {
    return;
  }
  try {
    const response = await fetch(CITY_COUNTY_LOOKUP_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`City lookup request failed (${response.status})`);
    }
    const lookup = await response.json();
    buildCityLookupIndex(lookup);
    cityLookupReady = true;
  } catch (error) {
    console.error("[lookup] failed to load city_county_lookup.json", error);
    buildCityLookupIndex({});
    cityLookupReady = true;
  }
}

function buildLocalFallbackEvents() {
  const now = new Date();
  return LOCAL_FALLBACK_EVENTS.map((event, index) => {
    const start = new Date(now);
    start.setDate(start.getDate() + index + 1);
    start.setHours(18 + (index % 3), 0, 0, 0);
    return {
      id: `local-fallback-${index + 1}`,
      title: event.title,
      inviteUrl: "",
      sourceUrl: "",
      category: event.category,
      cost: event.cost,
      date: start.toISOString(),
      location: event.location,
      source: "Vuily fallback",
      dateSource: "fallback",
      description: event.description,
    };
  });
}

function findCityMetadataFromAddress(venueAddress, venueName = "") {
  if (!cityLookupEntries.length) {
    return null;
  }

  const normalizedAddress = ` ${normalizeLookupText(`${venueName} ${venueAddress}`)} `;
  for (const entry of cityLookupEntries) {
    const needle = ` ${entry.normalized} `;
    if (normalizedAddress.includes(needle)) {
      return entry;
    }
  }

  return null;
}

function applyCityLookupFields(event) {
  if (!event) {
    return event;
  }
  if (event.city || event.cityName || event["Urban Classification"] || event.County) {
    return event;
  }

  const cityMeta = findCityMetadataFromAddress(event.location || "", event.title || "");
  if (!cityMeta) {
    return event;
  }

  return {
    ...event,
    cityName: cityMeta.cityName,
    city: cityMeta.cityName,
    urbanClassification: cityMeta.urbanClassification,
    "Urban Classification": cityMeta.urbanClassification,
    county: cityMeta.county,
    County: cityMeta.county,
  };
}

function enrichEventsWithCityLookup(events) {
  return (events || []).map((event) => applyCityLookupFields(event));
}

function extractPoshEventUrlsFromSitemap(xmlText) {
  const matches = String(xmlText || "").match(/<loc>https:\/\/posh\.vip\/e\/[^<]+<\/loc>/g) || [];
  return matches
    .map((value) => value.replace(/^<loc>/, "").replace(/<\/loc>$/, "").trim())
    .filter(Boolean);
}

function isLikelyBayAreaPoshSlug(url) {
  const slug = String(url || "").split("/").pop()?.toLowerCase() || "";
  if (!slug) {
    return false;
  }
  return poshSlugKeywords.some((keyword) => slug.includes(keyword));
}

async function discoverPoshBayAreaEventUrls() {
  try {
    const xmlText = await fetchTextWithProxyFallback(POSH_SITEMAP_RECENT_URL, "Posh sitemap request");
    const allEventUrls = extractPoshEventUrlsFromSitemap(xmlText);
    const likelyBay = allEventUrls.filter((url) => isLikelyBayAreaPoshSlug(url));
    return likelyBay.slice(0, POSH_DISCOVERY_MAX_URLS);
  } catch (error) {
    console.warn("[posh] sitemap discovery error", error);
    return [];
  }
}

function extractPoshField(htmlText, key) {
  const escapedPattern = new RegExp(`\\\\\\\\\"${key}\\\\\\\\\":\\\\\\\\\"([^\\\\\\\\\"]+)\\\\\\\\\"`, "i");
  const rawPattern = new RegExp(`\"${key}\":\"([^\"]+)\"`, "i");
  const escapedMatch = String(htmlText || "").match(escapedPattern);
  if (escapedMatch) {
    return decodeHtmlEntities(escapedMatch[1]);
  }
  const rawMatch = String(htmlText || "").match(rawPattern);
  if (rawMatch) {
    return decodeHtmlEntities(rawMatch[1]);
  }
  return "";
}

function extractPoshTitle(htmlText) {
  const titleMatch = String(htmlText || "").match(/<title>(.*?)<\/title>/i);
  if (!titleMatch) {
    return "";
  }
  return decodeHtmlEntities(titleMatch[1]).split("|")[0].trim();
}

function extractPoshMetaDescription(htmlText) {
  const descMatch = String(htmlText || "").match(/<meta name=\"description\" content=\"([^\"]*)\"/i);
  return descMatch ? decodeHtmlEntities(descMatch[1]).trim() : "";
}

function extractPoshNextJsonLd(htmlText) {
  const s = String(htmlText || "");

  // Try standard JSON-LD script tags first
  const doc = new DOMParser().parseFromString(s, "text/html");
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent);
      if (data?.["@type"] === "Event") return data;
    } catch (_) {}
  }

  // Posh uses Next.js RSC streaming — JSON-LD is double-escaped inside __next_f.push
  // Raw HTML literal chars: \"@type\": \"Event\", \"startDate\": \"2026-04-11T22:00:00-07:00\"
  if (!s.includes('\\"@type\\"') || !s.includes('Event')) return null;

  // Extract a field value from the escaped JSON-LD in the raw HTML
  const get = (src, key) => {
    const markers = [`\\"${key}\\": \\"`, `\\"${key}\\":\\"`, `"${key}":"`];
    for (const marker of markers) {
      const idx = src.indexOf(marker);
      if (idx === -1) continue;
      const start = idx + marker.length;
      const closeMarker = marker.endsWith('\\"') ? '\\"' : '"';
      const end = src.indexOf(closeMarker, start);
      if (end !== -1) return src.slice(start, end);
    }
    return "";
  };

  const name = get(s, "name");
  const startDate = get(s, "startDate");
  if (!name || !startDate) return null;

  const locIdx = s.indexOf('\\"location\\"');
  const locWindow = locIdx !== -1 ? s.slice(locIdx, locIdx + 700) : "";

  return {
    "@type": "Event",
    name,
    startDate,
    endDate: get(s, "endDate"),
    url: get(s, "url"),
    description: get(s, "description"),
    location: {
      name: get(locWindow, "name"),
      address: { streetAddress: get(locWindow, "streetAddress") },
    },
  };
}

function mapPoshEventPageToEvent(htmlText, eventUrl, index) {
  const title = extractPoshTitle(htmlText);
  if (!title) {
    return null;
  }

  const jsonLd = extractPoshNextJsonLd(htmlText);

  const startRaw = jsonLd?.startDate || extractPoshField(htmlText, "startUtc") || extractPoshField(htmlText, "startDate");
  const venueName = jsonLd?.location?.name || extractPoshField(htmlText, "venueName");
  const venueAddress = jsonLd?.location?.address?.streetAddress || extractPoshField(htmlText, "venueAddress");
  const shortDescription = jsonLd?.description || extractPoshField(htmlText, "shortDescription");
  const groupName = extractPoshField(htmlText, "groupName");
  const minTicketPrice = Number(extractPoshField(htmlText, "minTicketPrice") || 0);
  const eventId = extractPoshField(htmlText, "eventId") || `${index}`;

  const cityMeta = findCityMetadataFromAddress(venueAddress || venueName, venueName);
  if (!cityMeta && !jsonLd) {
    return null;
  }

  const startDate = new Date(startRaw || "");
  const safeDate = Number.isNaN(startDate.getTime())
    ? new Date().toISOString()
    : startDate.toISOString();
  const location = [venueName, venueAddress].filter(Boolean).join(" — ") || "Bay Area";
  const description =
    shortDescription ||
    extractPoshMetaDescription(htmlText) ||
    (groupName ? `Hosted by ${groupName}` : "Live event listing from Posh.");

  let cost = "Budget";
  if (minTicketPrice <= 0) {
    cost = "Free";
  } else if (minTicketPrice <= 25) {
    cost = "Budget";
  } else if (minTicketPrice <= 60) {
    cost = "Moderate";
  } else {
    cost = "Premium";
  }

  return {
    id: `posh-bay-${eventId}`,
    title,
    inviteUrl: eventUrl,
    sourceUrl: eventUrl,
    category: normalizeCategory(`${title} ${description} ${location} ${cityMeta.cityName}`),
    cost,
    date: safeDate,
    location,
    cityName: cityMeta.cityName,
    city: cityMeta.cityName,
    urbanClassification: cityMeta.urbanClassification,
    "Urban Classification": cityMeta.urbanClassification,
    county: cityMeta.county,
    County: cityMeta.county,
    source: "Posh",
    dateSource: timezone ? `posh:${timezone}` : "posh",
    description: briefDescription(description, 220),
    endDate: endUtc || "",
  };
}

async function fetchPoshBayAreaListings() {
  const discoveredUrls = await discoverPoshBayAreaEventUrls();
  const candidateUrls = [...new Set([...POSH_BAY_AREA_EVENT_URLS, ...discoveredUrls])].slice(
    0,
    POSH_VALIDATION_MAX_URLS
  );

  const results = await Promise.allSettled(
    candidateUrls.map((url, index) =>
      fetchTextWithProxyFallback(url, "Posh event request")
        .then((htmlText) => mapPoshEventPageToEvent(htmlText, url, index))
        .catch(() => null)
    )
  );

  const events = results
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter(Boolean);
  console.info("[posh] bay area events", events.length, "from candidates", candidateUrls.length);
  return events;
}

const state = {
  category: [],
  cost: [],
  dateRange: "today",
  allEvents: [],
  deckMessage: "",
  queue: [],
  reserved: [],
  reviews: {},
  points: 0,
  streak: 0,
  savedPage: 1,
  savedSearch: "",
  savedCategory: "all",
  isAnimatingSwipe: false,
  showPastPlans: false,
};

const cardDeck = document.getElementById("cardDeck");
const categoryFilterTrigger = document.getElementById("categoryFilterTrigger");
const categoryFilterDropdown = document.getElementById("categoryFilterDropdown");
const costFilterTrigger = document.getElementById("costFilterTrigger");
const costFilterDropdown = document.getElementById("costFilterDropdown");
const skipBtn = document.getElementById("skipBtn");
const reserveBtn = document.getElementById("reserveBtn");
const savedEvents = document.getElementById("savedEvents");
const dateFilter = document.getElementById("dateFilter");
const savedSearchInput = document.getElementById("savedSearch");
const savedCategoryFilter = document.getElementById("savedCategoryFilter");
const togglePastPlansBtn = document.getElementById("togglePastPlans");
const pointsEl = document.getElementById("points");
const streakEl = document.getElementById("streak");
const levelEl = document.getElementById("level");
const badgeEl = document.getElementById("badge");
const lastUpdatedEl = document.getElementById("lastUpdated");
const eventModal = document.getElementById("eventModal");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalWhen = document.getElementById("modalWhen");
const modalWhere = document.getElementById("modalWhere");
const modalDesc = document.getElementById("modalDesc");
const modalLink = document.getElementById("modalLink");
const modalSkip = document.getElementById("modalSkip");
const modalReserve = document.getElementById("modalReserve");
let modalEventId = null;
let lastFocusedElement = null;

function getCheckedValues(dropdown) {
  return Array.from(dropdown.querySelectorAll("input[type=checkbox]:checked")).map((cb) => cb.value);
}

function updateTriggerLabel(trigger, values) {
  trigger.textContent = values.length === 0 ? "All" : values.join(", ");
}

function toggleMultiSelect(trigger, dropdown) {
  const isOpen = dropdown.classList.contains("open");
  document.querySelectorAll(".multi-select-dropdown.open").forEach((d) => {
    d.classList.remove("open");
    d.previousElementSibling?.setAttribute("aria-expanded", "false");
  });
  if (!isOpen) {
    dropdown.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
  }
}

categoryFilterTrigger.addEventListener("click", () => {
  toggleMultiSelect(categoryFilterTrigger, categoryFilterDropdown);
});

categoryFilterDropdown.addEventListener("change", () => {
  state.category = getCheckedValues(categoryFilterDropdown);
  updateTriggerLabel(categoryFilterTrigger, state.category);
  refreshQueue();
});

costFilterTrigger.addEventListener("click", () => {
  toggleMultiSelect(costFilterTrigger, costFilterDropdown);
});

costFilterDropdown.addEventListener("change", () => {
  state.cost = getCheckedValues(costFilterDropdown);
  updateTriggerLabel(costFilterTrigger, state.cost);
  refreshQueue();
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".multi-select")) {
    document.querySelectorAll(".multi-select-dropdown.open").forEach((d) => {
      d.classList.remove("open");
      d.previousElementSibling?.setAttribute("aria-expanded", "false");
    });
  }
});

skipBtn.addEventListener("click", () => swipeTopCard("left"));
reserveBtn.addEventListener("click", () => swipeTopCard("right"));

if (dateFilter) {
  dateFilter.value = state.dateRange;
  dateFilter.addEventListener("change", () => {
    state.dateRange = dateFilter.value;
    refreshQueue();
  });
}

if (savedSearchInput) {
  savedSearchInput.addEventListener("input", () => {
    state.savedSearch = savedSearchInput.value.trim().toLowerCase();
    state.savedPage = 1;
    renderSavedEvents();
  });
}

if (savedCategoryFilter) {
  savedCategoryFilter.addEventListener("change", () => {
    state.savedCategory = savedCategoryFilter.value;
    state.savedPage = 1;
    renderSavedEvents();
  });
}

if (togglePastPlansBtn) {
  togglePastPlansBtn.addEventListener("click", () => {
    state.showPastPlans = !state.showPastPlans;
    togglePastPlansBtn.textContent = state.showPastPlans
      ? "Hide past plans"
      : "Show past plans";
    state.savedPage = 1;
    renderSavedEvents();
  });
}
function filterEvents() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayEndBuffer = new Date(startOfToday);
  todayEndBuffer.setHours(23, 59, 59, 999);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfUpcoming = new Date(startOfToday);
  endOfUpcoming.setDate(endOfUpcoming.getDate() + 7);
  const startOfWeek = new Date(startOfToday);
  const dayOfWeek = startOfWeek.getDay(); // 0 = Sunday
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const weekendStart = new Date(startOfWeek);
  weekendStart.setDate(weekendStart.getDate() + 6); // Saturday
  const weekendEnd = new Date(weekendStart);
  weekendEnd.setDate(weekendEnd.getDate() + 2); // Monday

  return state.allEvents
    .filter((event) => {
      if (!event || !event.date) {
        console.warn("[filter] missing date", event?.title);
      }
      const eventDate = new Date(event.date);
      const isUpcomingOrToday =
        !Number.isNaN(eventDate.getTime()) && eventDate >= startOfToday;
      const inToday =
        !Number.isNaN(eventDate.getTime()) &&
        eventDate >= startOfToday &&
        eventDate <= todayEndBuffer;
      const inWeek =
        !Number.isNaN(eventDate.getTime()) &&
        eventDate >= startOfToday &&
        eventDate < endOfWeek;
      const inWeekend =
        !Number.isNaN(eventDate.getTime()) &&
        eventDate >= weekendStart &&
        eventDate < weekendEnd;
      const inUpcoming =
        !Number.isNaN(eventDate.getTime()) &&
        eventDate >= endOfUpcoming;
      const dateMatch =
        state.dateRange === "all"
          ? true
          : state.dateRange === "today"
          ? inToday
          : state.dateRange === "week"
          ? inWeek
          : state.dateRange === "weekend"
          ? inWeekend
          : inUpcoming;
      const categoryMatch =
        state.category.length === 0 || state.category.includes(event.category);
      const costMatch =
        state.cost.length === 0 || state.cost.includes(event.cost);
      const notReserved = !state.reserved.find((entry) => entry.id === event.id);
      if (!(dateMatch && categoryMatch && costMatch && notReserved)) {
        if (!dateMatch) {
          console.warn("[filter] dateMatch false", event.title, event.date);
        }
      }
      return dateMatch && categoryMatch && costMatch && notReserved;
    })
    .sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      const safeATime = Number.isNaN(aTime) ? Number.POSITIVE_INFINITY : aTime;
      const safeBTime = Number.isNaN(bTime) ? Number.POSITIVE_INFINITY : bTime;
      return safeATime - safeBTime;
    });
}

function refreshQueue() {
  state.queue = filterEvents();
  renderDeck();
}

function renderDeck() {
  cardDeck.innerHTML = "";

  if (!state.queue.length) {
    cardDeck.innerHTML = `
      <div class="empty-state">
        ${state.deckMessage || "No events left for this filter. Try another category or cost range."}
      </div>
    `;
    return;
  }

  const stack = state.queue.slice(0, 3);
  stack
    .reverse()
    .forEach((event, index) => {
      const depth = stack.length - 1 - index;
      const card = createCard(event, depth);
      cardDeck.appendChild(card);
    });
}

function createCard(event, depth) {
  const card = document.createElement("article");
  const categorySlug = String(event.category || "Cultural")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  card.className = `event-card category-${categorySlug}`;
  card.dataset.id = event.id;
  card.style.transform = `translateY(${depth * 7}px) scale(${1 - depth * 0.03})`;
  card.style.zIndex = `${10 - depth}`;

  const whenLabel = getEventWhenLabel(event, { includeWeekday: true });

  card.innerHTML = `
    <span class="swipe-tag pass">PASS</span>
    <span class="swipe-tag reserve">RESERVE</span>
    <h3>
      <a href="${event.sourceUrl || event.inviteUrl || "#"}" target="_blank" rel="noopener noreferrer">
        ${event.title}
      </a>
    </h3>
    <div class="event-meta">
      <span class="pill category-pill category-${categorySlug}">
        <span class="category-dot" aria-hidden="true"></span>
        ${event.category}
      </span>
      <span class="pill cost-${event.cost}">${costLabel(event.cost)}</span>
    </div>
    <p><strong>When:</strong> ${whenLabel}</p>
    <p><strong>Where:</strong> ${event.location}</p>
    ${
      event.city || event["Urban Classification"] || event.County
        ? `<p><strong>City:</strong> ${event.city || event.cityName || "N/A"}${
            event["Urban Classification"]
              ? ` • <strong>Urban Classification:</strong> ${event["Urban Classification"]}`
              : ""
          }${event.County ? ` • <strong>County:</strong> ${event.County}` : ""}</p>`
        : ""
    }
    <p class="event-source">
      <strong>Source:</strong>
      <a href="${event.sourceUrl || event.inviteUrl || "#"}" target="_blank" rel="noopener noreferrer">
        ${event.source || "Funcheap"}
      </a>
    </p>
    <p class="event-desc">${event.description}</p>
  `;

  card.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("a")) {
      return;
    }
    openEventModal(event);
  });

  attachSwipe(card, event.id);
  return card;
}

function attachSwipe(card, eventId) {
  let isDragging = false;
  let startX = 0;
  let deltaX = 0;

  const passTag = card.querySelector(".swipe-tag.pass");
  const reserveTag = card.querySelector(".swipe-tag.reserve");

  card.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      return;
    }
    isDragging = true;
    startX = event.clientX;
    card.setPointerCapture(event.pointerId);
  });

  card.addEventListener("pointermove", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      return;
    }
    if (!isDragging) {
      return;
    }
    deltaX = event.clientX - startX;
    const rotation = deltaX / 15;
    card.style.transition = "none";
    card.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;

    passTag.style.opacity = deltaX < -35 ? "1" : "0";
    reserveTag.style.opacity = deltaX > 35 ? "1" : "0";
  });

  card.addEventListener("pointerup", () => {
    if (!isDragging) {
      return;
    }
    if (!isDragging) {
      return;
    }
    isDragging = false;
    card.style.transition = "transform 180ms ease, opacity 180ms ease";

    if (deltaX <= -100) {
      handleDecision(eventId, "left");
      return;
    }
    if (deltaX >= 100) {
      handleDecision(eventId, "right");
      return;
    }

    card.style.transform = "";
    passTag.style.opacity = "0";
    reserveTag.style.opacity = "0";
  });
}

function openEventModal(event) {
  if (!eventModal) {
    return;
  }
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (modalTitle) {
    modalTitle.textContent = decodeHtmlEntities(event.title || "Event");
  }
  if (modalMeta) {
    modalMeta.textContent = `${event.category} • ${costLabel(event.cost)}`;
  }
  if (modalWhen) {
    modalWhen.textContent = `When: ${getEventWhenLabel(event, { includeWeekday: true })}`;
  }
  if (modalWhere) {
    const cityBits = [
      event.city || event.cityName ? `City: ${event.city || event.cityName}` : "",
      event["Urban Classification"] ? `Urban Classification: ${event["Urban Classification"]}` : "",
      event.County ? `County: ${event.County}` : "",
    ]
      .filter(Boolean)
      .join(" • ");
    modalWhere.textContent = cityBits
      ? `Where: ${event.location || "San Francisco"} • ${cityBits}`
      : `Where: ${event.location || "San Francisco"}`;
  }
  if (modalDesc) {
    modalDesc.textContent = briefDescription(decodeHtmlEntities(event.description), 320);
  }
  if (modalLink) {
    const link = event.sourceUrl || event.inviteUrl || "#";
    modalLink.href = link;
  }
  modalEventId = event.id;
  console.warn("[modal] open", modalEventId);
  eventModal.classList.remove("hidden");
  eventModal.setAttribute("aria-hidden", "false");
  eventModal.removeAttribute("inert");
  document.body.style.overflow = "hidden";
  if (modalReserve) {
    modalReserve.focus();
  }
}

function closeEventModal() {
  if (!eventModal) {
    return;
  }
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  eventModal.classList.add("hidden");
  eventModal.setAttribute("aria-hidden", "true");
  eventModal.setAttribute("inert", "");
  document.body.style.overflow = "";
  modalEventId = null;
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

if (eventModal) {
  eventModal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.hasAttribute("data-modal-close") || target.closest("[data-modal-close]")) {
      closeEventModal();
    }
  });
}

if (modalSkip) {
  modalSkip.addEventListener("click", () => {
    console.warn("[modal] skip click", modalEventId);
    if (modalEventId) {
      const targetId = modalEventId;
      handleDecision(targetId, "left");
      const nextEvent = state.queue[0];
      if (nextEvent) {
        openEventModal(nextEvent);
      } else {
        closeEventModal();
      }
    }
  });
}

if (modalReserve) {
  modalReserve.addEventListener("click", () => {
    console.warn("[modal] reserve click", modalEventId);
    if (modalEventId) {
      const targetId = modalEventId;
      handleDecision(targetId, "right");
      const nextEvent = state.queue[0];
      if (nextEvent) {
        openEventModal(nextEvent);
      } else {
        closeEventModal();
      }
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeEventModal();
  }
});

function swipeTopCard(direction) {
  if (!state.queue.length || state.isAnimatingSwipe) {
    return;
  }
  const topEvent = state.queue[0];
  if (!topEvent) {
    return;
  }

  const topCard = cardDeck.querySelector(`.event-card[data-id="${topEvent.id}"]`);
  if (!topCard) {
    handleDecision(topEvent.id, direction);
    return;
  }

  animateCardDecision(topCard, topEvent.id, direction);
}

function animateCardDecision(card, eventId, direction) {
  state.isAnimatingSwipe = true;
  console.warn("[modal] animate", eventId, direction);
  const passTag = card.querySelector(".swipe-tag.pass");
  const reserveTag = card.querySelector(".swipe-tag.reserve");
  const isRight = direction === "right";
  const translateX = isRight ? "140%" : "-140%";
  const rotation = isRight ? "18deg" : "-18deg";

  if (passTag) {
    passTag.style.opacity = isRight ? "0" : "1";
  }
  if (reserveTag) {
    reserveTag.style.opacity = isRight ? "1" : "0";
  }

  card.style.transition = "transform 180ms ease, opacity 180ms ease";
  card.style.transform = `translateX(${translateX}) rotate(${rotation})`;
  card.style.opacity = "0.08";

  let finished = false;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    state.isAnimatingSwipe = false;
    handleDecision(eventId, direction);
  };

  card.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 260);
}

function handleDecision(eventId, direction) {
  console.warn("[modal] handleDecision", eventId, direction);
  const selected = state.queue.find((event) => event.id === eventId);
  if (!selected) {
    return;
  }

  if (direction === "right") {
    state.reserved.push(selected);
    state.savedPage = 1;
    addPoints(30);
    state.streak += 1;
  } else {
    addPoints(8);
    state.streak = Math.max(0, state.streak - 1);
  }

  state.queue = state.queue.filter((event) => event.id !== eventId);
  updateScoreBoard();
  renderDeck();
  renderSavedEvents();
}

function renderSavedEvents() {
  savedEvents.innerHTML = "";
  syncSavedCategoryOptions();
  if (!state.reserved.length) {
    savedEvents.innerHTML = `
      <div class="empty-state">
        Reserve events to build your playful plans!
      </div>
    `;
    return;
  }

  const { upcoming: upcomingReserved, past: pastReserved } =
    getFilteredOrderedReservedEvents();
  const orderedReserved = state.showPastPlans
    ? [...upcomingReserved, ...pastReserved]
    : upcomingReserved;
  if (!orderedReserved.length) {
    savedEvents.innerHTML = `
      <div class="empty-state">
        No reserved plans match your search/filter.
      </div>
    `;
    return;
  }

  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(orderedReserved.length / pageSize));
  state.savedPage = Math.min(Math.max(1, state.savedPage), totalPages);
  const pageStart = (state.savedPage - 1) * pageSize;
  const pageEvents = orderedReserved.slice(pageStart, pageStart + pageSize);

  const heading = document.createElement("p");
  heading.className = "saved-group-heading";
  heading.textContent = state.showPastPlans
    ? "Current & Upcoming"
    : state.savedPage === 1
    ? "Upcoming 5"
    : "More Reserved Plans";
  savedEvents.appendChild(heading);

  pageEvents.forEach((event) => {
    savedEvents.appendChild(createSavedCard(event));
  });

  if (totalPages > 1) {
    const pager = document.createElement("div");
    pager.className = "saved-pagination";
    pager.innerHTML = `
      <button class="tiny-btn" type="button" data-page-action="prev" ${
        state.savedPage === 1 ? "disabled" : ""
      }>
        Previous
      </button>
      <span class="saved-page-label">Page ${state.savedPage} of ${totalPages}</span>
      <button class="tiny-btn" type="button" data-page-action="next" ${
        state.savedPage === totalPages ? "disabled" : ""
      }>
        Next
      </button>
    `;
    savedEvents.appendChild(pager);
  }

  if (state.showPastPlans && pastReserved.length) {
    const pastHeading = document.createElement("p");
    pastHeading.className = "saved-group-heading";
    pastHeading.textContent = "Past Plans";
    savedEvents.appendChild(pastHeading);
    pastReserved.forEach((event) => {
      savedEvents.appendChild(createSavedCard(event));
    });
  }
}

function createSavedCard(event) {
  const item = document.createElement("article");
  item.className = "saved-card";
  const review = state.reviews[event.id] || "";
  const eventUrl = event.sourceUrl || event.inviteUrl || "#";

  item.innerHTML = `
    <h3><a href="${eventUrl}" target="_blank" rel="noopener noreferrer">${event.title}</a></h3>
    <p class="saved-meta">${event.category} • ${costLabel(event.cost)} • ${getEventWhenLabel(event)}</p>
    <details class="saved-details">
      <summary>View details</summary>
      <p><strong>Where:</strong> ${event.location || "San Francisco"}</p>
      ${
        event.city || event["Urban Classification"] || event.County
          ? `<p><strong>City:</strong> ${event.city || event.cityName || "N/A"}${
              event["Urban Classification"]
                ? ` • <strong>Urban Classification:</strong> ${event["Urban Classification"]}`
                : ""
            }${event.County ? ` • <strong>County:</strong> ${event.County}` : ""}</p>`
          : ""
      }
      <p><strong>About:</strong> ${briefDescription(event.description)}</p>
    </details>
    <div class="saved-actions">
      <button class="tiny-btn calendar" data-action="calendar" data-id="${event.id}">Add to Calendar</button>
      <button class="tiny-btn ${review === "up" ? "active-up" : ""}" data-action="up" data-id="${event.id}">Thumbs Up</button>
      <button class="tiny-btn ${review === "down" ? "active-down" : ""}" data-action="down" data-id="${event.id}">Thumbs Down</button>
    </div>
  `;
  return item;
}

function getEventTimestamp(event) {
  const timestamp = new Date(event.date).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function getOrderedReservedEvents() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const cutoff = startOfToday.getTime();
  const reservedCopy = [...state.reserved];

  const upcoming = reservedCopy
    .filter((event) => getEventTimestamp(event) >= cutoff)
    .sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));

  const pastOrUnknown = reservedCopy
    .filter((event) => getEventTimestamp(event) < cutoff)
    .sort((a, b) => getEventTimestamp(b) - getEventTimestamp(a));

  return { upcoming, past: pastOrUnknown };
}

function getFilteredOrderedReservedEvents() {
  const { upcoming, past } = getOrderedReservedEvents();
  const filterFn = (event) => {
    const categoryMatch =
      state.savedCategory === "all" || event.category === state.savedCategory;
    if (!categoryMatch) {
      return false;
    }

    if (!state.savedSearch) {
      return true;
    }

    const haystack = [
      event.title,
      event.category,
      event.location,
      event.description,
      event.source,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(state.savedSearch);
  };

  return {
    upcoming: upcoming.filter(filterFn),
    past: past.filter(filterFn),
  };
}

function syncSavedCategoryOptions() {
  if (!savedCategoryFilter) {
    return;
  }

  const categories = [...new Set(state.reserved.map((event) => event.category).filter(Boolean))];
  categories.sort((a, b) => a.localeCompare(b));
  const validValues = new Set(["all", ...categories]);
  if (!validValues.has(state.savedCategory)) {
    state.savedCategory = "all";
  }

  const optionsHtml = ['<option value="all">All Categories</option>']
    .concat(categories.map((category) => `<option value="${category}">${category}</option>`))
    .join("");
  savedCategoryFilter.innerHTML = optionsHtml;
  savedCategoryFilter.value = state.savedCategory;
}

savedEvents.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const pageAction = target.dataset.pageAction;
  if (pageAction === "prev" && state.savedPage > 1) {
    state.savedPage -= 1;
    renderSavedEvents();
    return;
  }
  if (pageAction === "next") {
    state.savedPage += 1;
    renderSavedEvents();
    return;
  }

  const eventId = target.dataset.id;
  const action = target.dataset.action;
  if (!eventId || !action) {
    return;
  }

  const chosenEvent = state.reserved.find((entry) => entry.id === eventId);
  if (!chosenEvent) {
    return;
  }

  if (action === "calendar") {
    downloadICS(chosenEvent);
    addPoints(12);
  }

  if (action === "up") {
    state.reviews[eventId] = "up";
    addPoints(20);
  }

  if (action === "down") {
    state.reviews[eventId] = "down";
    addPoints(5);
  }

  updateScoreBoard();
  renderSavedEvents();
});

function addPoints(amount) {
  state.points += amount;
}

function updateScoreBoard() {
  pointsEl.textContent = `${state.points}`;
  streakEl.textContent = `${state.streak}`;
  levelEl.textContent = getLevel();
  badgeEl.textContent = `Badge: ${getBadge()}`;
}

function getLevel() {
  if (state.points >= 220) {
    return "Legend";
  }
  if (state.points >= 130) {
    return "Trailblazer";
  }
  if (state.points >= 70) {
    return "City Scout";
  }
  return "Explorer";
}

function getBadge() {
  if (state.reserved.length >= 5) {
    return "Weekend Hero";
  }
  if (Object.values(state.reviews).filter((value) => value === "up").length >= 3) {
    return "Good Vibes Curator";
  }
  if (state.streak >= 4) {
    return "Hot Streak";
  }
  return "Newcomer";
}

function prettyDate(dateString) {
  return formatDateTime(dateString);
}

function getEventWhenLabel(event, options = {}) {
  return formatDateTime(event?.date, options);
}

function formatDateTime(dateInput, options = {}) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  const { includeWeekday = false, includeYear = false } = options;
  return date.toLocaleString("en-US", {
    ...(includeWeekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

function briefDescription(text, maxLength = 160) {
  const value = String(text || "").trim().replace(/\s+/g, " ");
  if (!value) {
    return "Details coming soon.";
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function costLabel(cost) {
  const map = {
    Free: "Free",
    Budget: "$ Budget",
    Moderate: "$$ Moderate",
    Premium: "$$$ Premium",
  };
  return map[cost] || cost;
}

function setDeckMessage(message) {
  cardDeck.innerHTML = `
    <div class="empty-state">${message}</div>
  `;
}

function updateLastUpdated(date = new Date(), suffix = "") {
  if (!lastUpdatedEl) {
    return;
  }
  const label = formatDateTime(date, { includeYear: true });
  lastUpdatedEl.textContent = `Last updated: ${label}${suffix}`;
}

function normalizeCategory(rawText) {
  const text = rawText.toLowerCase();
  const nineteenHzTags = [
    "house",
    "techno",
    "trance",
    "disco",
    "drum & bass",
    "drum and bass",
    "dnb",
    "dubstep",
    "bass",
    "ukg",
    "garage",
    "hardstyle",
    "hardcore",
    "jungle",
    "electro",
    "edm",
    "rave",
    "club",
    "dj",
    "ambient",
    "downtempo",
    "experimental",
    "live electronic",
    "synth",
    "breakbeat",
    "lo-fi",
    "lofi",
  ];
  if (nineteenHzTags.some((tag) => text.includes(tag))) {
    return "Music";
  }
  if (
    text.includes("music") ||
    text.includes("concert") ||
    text.includes("dj") ||
    text.includes("jazz")
  ) {
    return "Music";
  }
  if (
    text.includes("art") ||
    text.includes("gallery") ||
    text.includes("museum") ||
    text.includes("theater") ||
    text.includes("performance")
  ) {
    return "Arts";
  }
  if (
    text.includes("hike") ||
    text.includes("outdoor") ||
    text.includes("park") ||
    text.includes("nature") ||
    text.includes("bike")
  ) {
    return "Outdoors";
  }
  return "Cultural";
}

function normalizeCost(rawText) {
  const text = rawText.toLowerCase();
  if (
    text.includes("free") ||
    text.includes("no cost") ||
    text.includes("$0") ||
    text === ""
  ) {
    return "Free";
  }
  if (text.includes("$$$") || text.includes("premium") || text.includes("high")) {
    return "Premium";
  }
  if (text.includes("$$") || text.includes("moderate") || text.includes("mid")) {
    return "Moderate";
  }
  return "Budget";
}

function stripHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  return (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
}

function splitDescriptionAndSource(text, defaultSource = "Funcheap") {
  const value = String(text || "").trim();
  if (!value) {
    return { description: "", source: defaultSource };
  }

  const sourceMatch = value.match(
    /(The post\s+.+?\s+appeared first on\s+[^.]+\.)/i
  );
  if (!sourceMatch) {
    return { description: value, source: defaultSource };
  }

  const source = sourceMatch[1].trim();
  const description = value.replace(sourceMatch[1], "").replace(/\s+/g, " ").trim();
  return { description, source };
}

function extractLocationFromContent(html) {
  const textWithLines = String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/blockquote>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");

  const lines = textWithLines
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const locationPattern =
    /(?:\d{2,6}\s+[A-Za-z0-9.'# -]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Pl|Place|Ct|Court)\b.*(?:,\s*[A-Za-z .'-]+){0,3}|[A-Za-z .'-]+,\s*(?:SF|San Francisco|Oakland|Berkeley|San Jose|Vallejo|CA)\b)/i;
  const venueInCityPattern =
    /\bat\s+([A-Za-z0-9&.' -]{3,80}?)\s+in\s+(San Francisco|SF|Oakland|Berkeley|San Jose|Vallejo)\b/i;

  for (const line of lines) {
    const venueMatch = line.match(venueInCityPattern);
    if (venueMatch) {
      const venue = venueMatch[1].trim();
      const city = venueMatch[2].trim();
      return `${venue}, ${city === "SF" ? "San Francisco" : city}`;
    }

    if (!locationPattern.test(line)) {
      continue;
    }

    const cleaned = line
      .replace(/\s+\|\s+.*$/i, "")
      .replace(/\s+(FREE|RSVP)\b.*$/i, "")
      .replace(/\s+-\s+\$?\d+.*$/i, "")
      .trim();

    if (cleaned.length >= 5) {
      return cleaned;
    }
  }

  return "";
}

function extractLocationFromTitle(title) {
  const text = String(title || "").trim();
  if (!text) {
    return "";
  }

  const titleWithoutDate = text.replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*:\s*/, "");
  const lower = titleWithoutDate.toLowerCase();

  const cityFromPipe = titleWithoutDate.match(
    /\|\s*(SF|San Francisco|Oakland|Berkeley|San Jose|Vallejo)\b/i
  );
  if (cityFromPipe) {
    const city = cityFromPipe[1];
    return city.toLowerCase() === "sf" ? "San Francisco" : city;
  }

  const cityFromParen = titleWithoutDate.match(
    /\((SF|San Francisco|Oakland|Berkeley|San Jose|Vallejo)\)/i
  );
  if (cityFromParen) {
    const city = cityFromParen[1];
    return city.toLowerCase() === "sf" ? "San Francisco" : city;
  }

  const venueFromParenWithSF = titleWithoutDate.match(/\(([^)]+)\).*?\b(SF|San Francisco)\b/i);
  if (venueFromParenWithSF) {
    return `${venueFromParenWithSF[1].trim()}, San Francisco`;
  }

  if (lower.includes("downtown sf")) {
    return "Downtown San Francisco";
  }

  return "";
}

function parseDateFromTitle(title, fallbackYear = new Date().getFullYear()) {
  const match = String(title || "")
    .trim()
    .match(/(?:^|\b)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*[:\-]/);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const rawYear = match[3] ? Number(match[3]) : Number(fallbackYear);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  if (!month || !day || !year) {
    return null;
  }

  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function deriveDateFromUrl(link, fallbackYear = new Date().getFullYear()) {
  const match = String(link || "").match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) {
    return null;
  }
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function mapFeedItemToEvent(item, index, sourceName = "Funcheap") {
  const title = decodeHtmlEntities((item.title || "").trim());
  const descriptionHtml = item.content || item.description || "";
  const { description, source } = splitDescriptionAndSource(
    stripHtml(descriptionHtml),
    sourceName
  );
  const location =
    extractLocationFromContent(descriptionHtml) || extractLocationFromTitle(title);
  let link = (item.link || "").trim();
  link = normalizeEventUrl(link);
  const guid = (item.guid || "").trim();
  const pubDate = (item.pubDate || "").trim();
  const categoryList = Array.isArray(item.categories)
    ? item.categories.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const categoryText = `${categoryList.join(" ")} ${title} ${description}`;
  const publishedDate = new Date(pubDate);
  const fallbackYear = Number.isNaN(publishedDate.getTime())
    ? new Date().getFullYear()
    : publishedDate.getFullYear();
  const titleDate = parseDateFromTitle(title, fallbackYear);
  const urlDate = deriveDateFromUrl(link, fallbackYear);
  const monthNameDate =
    parseMonthNameDate(title, fallbackYear) ||
    parseMonthNameDate(description, fallbackYear);
  const hasPublishedDate = !Number.isNaN(publishedDate.getTime());
  let dateSource = "unknown";
  let chosenDate = null;
  if (urlDate) {
    chosenDate = urlDate;
    dateSource = "url";
  } else if (monthNameDate) {
    chosenDate = monthNameDate;
    dateSource = "monthName";
  } else if (titleDate) {
    chosenDate = titleDate;
    dateSource = "title";
  } else if (hasPublishedDate) {
    chosenDate = publishedDate;
    dateSource = "published";
  }
  const safeDate = (chosenDate || new Date()).toISOString();

  if (!title) {
    return null;
  }

  return {
    id: `${sourceName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${guid || link || index}`,
    title,
    inviteUrl: link,
    sourceUrl: link,
    category: normalizeCategory(categoryText),
    cost: normalizeCost(`${title} ${description}`),
    date: safeDate,
    location: location || "San Francisco",
    source,
    dateSource,
    description: decodeHtmlEntities(description || ""),
  };
}

function map19hzItemToEvent(item, index) {
  const title = decodeHtmlEntities((item.title || "").trim());
  if (!title) {
    return null;
  }

  const link = normalizeEventUrl(item.link || item.guid || "");
  if (!link || isSocialLink(link)) {
    return null;
  }
  const tagsText = item._19hz?.tagsText || "";
  const venueText = item._19hz?.venueText || "";
  const priceText = item._19hz?.priceText || "";
  const organizerText = item._19hz?.organizerText || "";
  const dateText = item._19hz?.dateText || "";
  const ymdText = item._19hz?.ymdText || "";
  const timeText = item._19hz?.timeText || "";

  const baseDate = parseYmdDate(ymdText) || parseMonthNameDate(dateText);
  if (!baseDate) {
    return null;
  }
  const dated = applyTimeToDate(baseDate, timeText);

  const descriptionParts = [];
  if (tagsText) {
    descriptionParts.push(`Tags: ${tagsText}`);
  }
  if (organizerText) {
    descriptionParts.push(`Organizer: ${organizerText}`);
  }
  const description = descriptionParts.join(" • ");

  return {
    id: `19hz-${(link || title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    title,
    inviteUrl: link,
    sourceUrl: link,
    category: normalizeCategory(`${tagsText} ${title}`),
    cost: normalizeCost(`${priceText} ${title}`),
    date: dated.toISOString(),
    location: venueText || "Bay Area",
    source: "19hz",
    dateSource: "19hz",
    description,
  };
}

function parseRssText(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("Unable to parse RSS XML");
  }

  const channel = doc.querySelector("channel");
  const items = Array.from(doc.querySelectorAll("item")).map((item) => {
    const getText = (selectors, tagNames = []) => {
      for (const selector of selectors) {
        const node = item.querySelector(selector);
        if (node && node.textContent) {
          return node.textContent;
        }
      }
      for (const tagName of tagNames) {
        const nodes = item.getElementsByTagName(tagName);
        if (nodes.length && nodes[0].textContent) {
          return nodes[0].textContent;
        }
      }
      return "";
    };

    const categories = Array.from(item.querySelectorAll("category")).map((node) =>
      String(node.textContent || "").trim()
    );

    return {
      title: getText(["title"]),
      link: getText(["link"]),
      pubDate: getText(["pubDate"]),
      guid: getText(["guid"]),
      description: getText(["description"]),
      content: getText([], ["content:encoded", "encoded"]),
      categories,
    };
  });

  return {
    feed: {
      lastBuildDate: channel?.querySelector("lastBuildDate")?.textContent || "",
    },
    items,
  };
}

function parseListingHtml(htmlText, baseUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  const baseDate = deriveDateFromUrl(baseUrl);
  const articles = Array.from(
    doc.querySelectorAll("article, .event, .listing, .entry, .post")
  );

  const items = articles
    .map((article) => {
      const titleLink =
        article.querySelector("h1 a, h2 a, h3 a, .entry-title a, .title a") ||
        article.querySelector("a[href]");
      if (!titleLink) {
        return null;
      }
      const title = decodeHtmlEntities((titleLink.textContent || "").trim());
      const rawLink = titleLink.getAttribute("href") || "";
      let link = rawLink;
      try {
        link = new URL(rawLink, baseUrl).toString();
      } catch (error) {
        // Keep raw link if URL resolution fails.
      }

      const timeEl =
        article.querySelector("time[datetime]") ||
        article.querySelector("time") ||
        article.querySelector(".date, .entry-date, .event-date, .date-meta");
      const timeText = timeEl
        ? timeEl.getAttribute("datetime") || timeEl.textContent || ""
        : "";
      const parsedListingDate = parseMonthNameDate(timeText);

      const excerpt = decodeHtmlEntities(
        article.querySelector(".entry-summary, .excerpt, .summary, p")?.textContent ||
          ""
      );

      return {
        title,
        link,
        pubDate: parsedListingDate ? parsedListingDate.toISOString() : timeText,
        guid: link,
        description: excerpt,
        content: "",
        categories: [],
      };
    })
    .filter(Boolean);

  return items;
}

function decodeHtmlEntities(text) {
  const value = String(text || "");
  if (!value) {
    return "";
  }
  const doc = new DOMParser().parseFromString(value, "text/html");
  return doc.documentElement.textContent || "";
}

function parseListingFallbackLinks(doc, baseUrl, baseDate) {
  const links = Array.from(
    doc.querySelectorAll(".title2.entry-title a, a.title2.entry-title, .entry-title a")
  );
  const fallbackItems = links
    .map((linkEl) => {
      const title = decodeHtmlEntities((linkEl.textContent || "").trim());
      const rawLink = linkEl.getAttribute("href") || "";
      if (!title || !rawLink) {
        return null;
      }
      let link = rawLink;
      try {
        link = new URL(rawLink, baseUrl).toString();
      } catch (error) {
        // ignore
      }
      return {
        title,
        link,
        pubDate: baseDate ? baseDate.toISOString() : "",
        guid: link,
        description: "",
        content: "",
        categories: [],
      };
    })
    .filter(Boolean);

  return fallbackItems;
}

function parseMonthNameDate(text, fallbackYear = new Date().getFullYear()) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/(\d)(st|nd|rd|th)\b/gi, "$1")
    .trim();
  if (!cleaned) {
    return null;
  }

  const monthNames = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  const match = cleaned.match(
    /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s,.-]*(\d{1,2})(?:[\s,.-]*(\d{4}))?/i
  );
  if (!match) {
    return null;
  }

  const monthKey = match[1].toLowerCase();
  const month = monthNames[monthKey];
  const day = Number(match[2]);
  const year = match[3] ? Number(match[3]) : fallbackYear;
  if (!month || !day || !year) {
    return null;
  }

  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function normalizeEventUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) {
    return "";
  }
  try {
    return new URL(value, "https://sf.funcheap.com").toString();
  } catch (error) {
    return value;
  }
}

function parseYmdDate(value) {
  const match = String(value || "").trim().match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) {
    return null;
  }
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function applyTimeToDate(date, timeText) {
  if (!date || !timeText) {
    return date;
  }
  const match = String(timeText).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) {
    return date;
  }
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }
  const updated = new Date(date);
  updated.setHours(hour, minute, 0, 0);
  return updated;
}

function isSocialLink(url) {
  const value = String(url || "").toLowerCase();
  return (
    value.includes("instagram.com") ||
    value.includes("facebook.com") ||
    value.includes("fb.me") ||
    value.includes("tiktok.com") ||
    value.includes("x.com") ||
    value.includes("twitter.com") ||
    value.includes("threads.net") ||
    value.includes("youtube.com") ||
    value.includes("youtu.be") ||
    value.includes("snapchat.com") ||
    value.includes("linktr.ee")
  );
}

function isTicketingLink(url) {
  const value = String(url || "").toLowerCase();
  return (
    value.includes("eventbrite.com") ||
    value.includes("dice.fm") ||
    value.includes("seetickets") ||
    value.includes("ticketmaster.") ||
    value.includes("axs.com") ||
    value.includes("etix.com") ||
    value.includes("brownpapertickets.com") ||
    value.includes("tixr.com") ||
    value.includes("universe.com") ||
    value.includes("simpletix.com") ||
    value.includes("frontgatetickets.com") ||
    value.includes("seeTickets") ||
    value.includes("eventim") ||
    value.includes("ticketweb.com") ||
    value.includes("ra.co/events") ||
    value.includes("posh.vip") ||
    value.includes("feverup.com")
  );
}

async function fetchListingPage(url) {
  const htmlText = await fetchTextWithProxyFallback(url, "Listing request");
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const primaryItems = parseListingHtml(htmlText, url);
  const fallbackItems = parseListingFallbackLinks(doc, url, deriveDateFromUrl(url));
  const items = [...primaryItems, ...fallbackItems];
  console.info("[listings] items", url, items.length);
  return items;
}

function parse19hzHtml(htmlText) {
  const items = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  const extractCells = (rowHtml) => {
    const cells = [];
    const tdMatches = Array.from(rowHtml.matchAll(/<td[^>]*>/gi));
    if (!tdMatches.length) {
      return cells;
    }
    for (let i = 0; i < tdMatches.length; i += 1) {
      const start = tdMatches[i].index + tdMatches[i][0].length;
      const end = i + 1 < tdMatches.length ? tdMatches[i + 1].index : rowHtml.length;
      cells.push(rowHtml.slice(start, end));
    }
    return cells;
  };

  const extractHref = (html) => {
    const match = String(html || "").match(/href=['"]([^'"]+)['"]/i);
    return match ? match[1] : "";
  };

  while ((rowMatch = rowRegex.exec(htmlText))) {
    const rowHtml = rowMatch[1] || "";
    if (!rowHtml.includes("<td")) {
      continue;
    }
    const cells = extractCells(rowHtml);
    if (cells.length < 2) {
      continue;
    }

    const dateHtml = cells[0] || "";
    const titleHtml = cells[1] || "";
    const tagsHtml = cells[2] || "";
    const priceHtml = cells[3] || "";
    const organizerHtml = cells[4] || "";
    const linksHtml = cells[5] || "";
    const ymdHtml = cells[6] || "";

    const dateText = stripHtml(dateHtml);
    const timeMatch = dateText.match(/\(([^)]+)\)/);
    const timeText = timeMatch ? timeMatch[1] : "";
    let ymdText = stripHtml(ymdHtml);
    if (!ymdText) {
      const ymdMatch = rowHtml.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
      ymdText = ymdMatch ? ymdMatch[0] : "";
    }

    const dateFromYmd = parseYmdDate(ymdText);
    const dateFromMonth = parseMonthNameDate(dateText);
    let eventDate = dateFromYmd || dateFromMonth || null;
    eventDate = applyTimeToDate(eventDate, timeText);

    const titleText = decodeHtmlEntities(stripHtml(titleHtml));
    const title = titleText.trim();
    if (!title) {
      continue;
    }
    const venueSplit = titleText.split(" @ ");
    const venueText = venueSplit.length > 1 ? venueSplit.slice(1).join(" @ ").trim() : "";

    const tagsText = decodeHtmlEntities(stripHtml(tagsHtml));
    const priceText = decodeHtmlEntities(stripHtml(priceHtml));
    const organizerText = decodeHtmlEntities(stripHtml(organizerHtml));

    const linkPrimary = extractHref(titleHtml);
    const linkAlt = extractHref(linksHtml);
    const link = linkPrimary || (isTicketingLink(linkAlt) ? linkAlt : "");

    const descriptionParts = [];
    if (tagsText) {
      descriptionParts.push(`Tags: ${tagsText}`);
    }
    const description = descriptionParts.join(" • ");

    items.push({
      title,
      link,
      pubDate: eventDate ? eventDate.toISOString() : "",
      guid: link || `${title}-${ymdText || dateText}`,
      description,
      content: "",
      categories: tagsText ? tagsText.split(",").map((tag) => tag.trim()) : [],
      _19hz: {
        tagsText,
        venueText,
        priceText,
        organizerText,
        dateText,
        ymdText,
        timeText,
      },
    });
  }

  return items;
}

async function fetch19hzListings() {
  const htmlText = await fetchTextWithProxyFallback(NINETEENHZ_URL, "19hz request");
  const items = parse19hzHtml(htmlText);
  console.info("[19hz] items", items.length);
  return items;
}

function extractJsonLdEvents(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  const events = [];
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      const candidates = Array.isArray(data) ? data : [data];
      for (const item of candidates) {
        if (item["@type"] === "Event") {
          events.push(item);
        } else if (item["@type"] === "ItemList" && Array.isArray(item.itemListElement)) {
          for (const el of item.itemListElement) {
            if (el["@type"] === "ListItem" && el.startDate) events.push(el);
            else if (el.item && el.item["@type"] === "Event") events.push(el.item);
          }
        }
      }
    } catch (_) {}
  }
  return events;
}

function mapMeetupEventToEvent(item, index) {
  const title = decodeHtmlEntities((item.name || "").trim());
  if (!title) return null;
  const startDate = item.startDate;
  if (!startDate) return null;
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return null;
  const loc = item.location || {};
  const addr = loc.address || {};
  const venue = [loc.name, addr.streetAddress, addr.addressLocality]
    .filter(Boolean).join(", ");
  const url = (item.url || "").trim();
  const description = decodeHtmlEntities(stripHtml(item.description || ""));
  return {
    id: `meetup-${(url || title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    title,
    inviteUrl: url,
    sourceUrl: url,
    category: normalizeCategory(`${title} ${description} ${venue}`),
    cost: normalizeCost(`${title} ${description}`),
    date: date.toISOString(),
    location: venue || "San Francisco",
    source: "Meetup",
    dateSource: "meetup",
    description,
  };
}

async function fetchMeetupEvents() {
  const htmlText = await fetchTextWithProxyFallback(MEETUP_SF_URL, "Meetup request");
  const items = extractJsonLdEvents(htmlText);
  console.info("[meetup] json-ld events found", items.length);
  return items;
}

function mapEventbriteEventToEvent(item, index) {
  const title = decodeHtmlEntities((item.name || "").trim());
  if (!title) return null;
  const startDate = item.startDate;
  if (!startDate) return null;
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return null;
  const loc = item.location || {};
  const addr = loc.address || {};
  const venue = [loc.name, addr.streetAddress, addr.addressLocality]
    .filter(Boolean).join(", ");
  const url = (item.url || "").trim();
  const description = decodeHtmlEntities(stripHtml(item.description || ""));
  const isOnline = (item.eventAttendanceMode || "").includes("Online");
  if (isOnline) return null;
  return {
    id: `eventbrite-${(url || title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    title,
    inviteUrl: url,
    sourceUrl: url,
    category: normalizeCategory(`${title} ${description} ${venue}`),
    cost: normalizeCost(`${title} ${description}`),
    date: date.toISOString(),
    location: venue || "San Francisco",
    source: "Eventbrite",
    dateSource: "eventbrite",
    description,
  };
}

async function fetchEventbriteEvents() {
  const htmlText = await fetchTextWithProxyFallback(EVENTBRITE_SF_URL, "Eventbrite request");
  const items = extractJsonLdEvents(htmlText);
  console.info("[eventbrite] json-ld events found", items.length);
  return items;
}

function parseTimeoutSFHtml(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const results = [];
  const anchors = Array.from(doc.querySelectorAll("a[href]"));
  for (const anchor of anchors) {
    const href = anchor.getAttribute("href") || "";
    if (!href.includes("/san-francisco/") || href === "/san-francisco/things-to-do") continue;
    const heading = anchor.querySelector("h3, h4, h2");
    if (!heading) continue;
    const title = decodeHtmlEntities(heading.textContent.trim());
    if (!title || title.length < 5) continue;
    const desc = anchor.querySelector("p");
    const description = desc ? decodeHtmlEntities(desc.textContent.trim()) : "";
    const fullHref = href.startsWith("http") ? href : `https://www.timeout.com${href}`;
    results.push({ title, description, url: fullHref });
  }
  return results;
}

function mapTimeoutSFArticleToEvent(item, index) {
  const title = item.title;
  if (!title) return null;
  const weekend = new Date();
  weekend.setDate(weekend.getDate() + (index % 3));
  weekend.setHours(14 + (index % 6), 0, 0, 0);
  return {
    id: `timeout-${(item.url || title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    title,
    inviteUrl: item.url,
    sourceUrl: item.url,
    category: normalizeCategory(`${title} ${item.description}`),
    cost: normalizeCost(`${title} ${item.description}`),
    date: weekend.toISOString(),
    location: "San Francisco",
    source: "Timeout SF",
    dateSource: "timeout-editorial",
    description: item.description || "",
  };
}

async function fetchTimeoutSFEvents() {
  const htmlText = await fetchTextWithProxyFallback(TIMEOUT_SF_URL, "Timeout SF request");
  const items = parseTimeoutSFHtml(htmlText);
  console.info("[timeout] articles found", items.length);
  return items;
}

async function fetchFuncheapListings() {
  const items = [];
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayArchive = `https://sf.funcheap.com/${yyyy}/${mm}/${dd}/`;
  const listingUrls = [...SFFUNCHEAP_LISTING_URLS, todayArchive];
  for (const url of listingUrls) {
    try {
      const pageItems = await fetchListingPage(url);
      items.push(...pageItems);
    } catch (error) {
      console.error("[listings] error", url, error);
    }
  }
  return items;
}

async function fetchEventPageData(url) {
  const htmlText = await fetchTextWithProxyFallback(url, "Event page request");
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    const text = script.textContent || "";
    if (!text.includes("startDate") && !text.includes("location") && !text.includes("description")) {
      continue;
    }
    try {
      const data = JSON.parse(text);
      const eventData = Array.isArray(data)
        ? data.find((d) => d.startDate || d.location || d.description)
        : data;
      if (eventData && (eventData.startDate || eventData.location)) {
        const startDate = eventData.startDate ? new Date(eventData.startDate) : null;
        const locationName = eventData.location?.name || "";
        const address = eventData.location?.address;
        const addressText =
          typeof address === "string"
            ? address
            : address
            ? [address.streetAddress, address.addressLocality, address.addressRegion]
                .filter(Boolean)
                .join(", ")
            : "";
        const location = [locationName, addressText].filter(Boolean).join(" — ");
        const description = eventData.description ? String(eventData.description) : "";
        return { startDate, location, description: decodeHtmlEntities(description) };
      }
    } catch (error) {
      const match = text.match(/"startDate"\s*:\s*"([^"]+)"/);
      const startDate = match ? new Date(match[1]) : null;
      return { startDate, location: "", description: "" };
    }
  }
  const metaDescription =
    doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  return { startDate: null, location: "", description: decodeHtmlEntities(metaDescription) };
}

async function enrichFuncheapDates(events, maxChecks = Infinity) {
  const candidates = events
    .filter(
      (event) =>
        event.source === "SF Funcheap" &&
        event.dateSource !== "url" &&
        (event.sourceUrl || event.inviteUrl)
    )
    .slice(0, Number.isFinite(maxChecks) ? maxChecks : undefined);

  console.warn("[eventPage] candidates", candidates.length);
  if (!candidates.length) {
    return events;
  }

  const updates = await Promise.all(
    candidates.map(async (event) => {
      try {
        const { startDate, location, description } = await fetchEventPageData(
          event.sourceUrl || event.inviteUrl
        );
        const hasDate = startDate && !Number.isNaN(startDate.getTime());
        const hasLocation = location && location.trim().length > 0;
        const hasDescription = description && description.trim().length > 0;
        if (hasDate || hasLocation || hasDescription) {
          console.warn("[eventPage] updated", event.sourceUrl || event.inviteUrl);
          return {
            ...event,
            date: hasDate ? startDate.toISOString() : event.date,
            dateSource: hasDate ? "eventPage" : event.dateSource,
            location: hasLocation ? location : event.location,
            description: hasDescription ? briefDescription(description, 220) : event.description,
          };
        }
      } catch (error) {
        console.error("[eventPage] date parse error", error);
      }
      return event;
    })
  );

  const updatedMap = new Map(updates.map((event) => [event.id, event]));
  return events.map((event) => updatedMap.get(event.id) || event);
}

async function fetchRssPayload(url) {
  const xmlText = await fetchTextWithProxyFallback(url, "Feed request");
  const payload = parseRssText(xmlText);
  if (Array.isArray(payload.items) && payload.items.length > 0) {
    console.info("[feed] items", url, payload.items.length);
    return payload;
  }
  throw new Error("Feed request failed via proxy");
}

async function fetchFuncheapPayload() {
  let lastError = null;
  const payloads = [];

  for (const url of SFFUNCHEAP_RSS_URLS) {
    try {
      const payload = await fetchRssPayload(url);
      payloads.push(payload);
    } catch (error) {
      lastError = error;
    }
  }

  for (let page = 2; page <= SFFUNCHEAP_MAX_PAGES; page += 1) {
    const pagedUrl = `${SFFUNCHEAP_FEED_URL}?paged=${page}`;
    try {
      const payload = await fetchRssPayload(pagedUrl);
      if (!payload.items || payload.items.length === 0) {
        break;
      }
      payloads.push(payload);
    } catch (error) {
      lastError = error;
      break;
    }
  }

  if (!payloads.length) {
    throw lastError || new Error("Unable to load SF Funcheap feed");
  }

  const allItems = payloads.flatMap((payload) => payload.items || []);
  const lastBuildDates = payloads
    .map((payload) => new Date(payload.feed?.lastBuildDate || ""))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => date.getTime());
  const latest = lastBuildDates.length ? new Date(Math.max(...lastBuildDates)) : new Date();

  return {
    feed: { lastBuildDate: latest.toISOString() },
    items: allItems,
  };
}

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = event.id || event.sourceUrl || `${event.title}|${event.date}|${event.location}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function loadEvents() {
  state.deckMessage = "";
  setDeckMessage("Loading live SF events...");
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = "Last updated: refreshing live feed...";
  }

  await loadCityCountyLookup();

  try {
    console.warn("[debug] loadEvents start");
    const listingItems = await fetchFuncheapListings();
    const listingMapped = listingItems
      .map((item, index) => mapFeedItemToEvent(item, index, "SF Funcheap"))
      .filter(Boolean);
    console.warn("[listings] mapped", listingMapped.length);

    let feedMapped = [];
    let feedStamp = new Date();
    try {
      const payload = await Promise.race([
        fetchFuncheapPayload(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Feed request timed out")), 8000)
        ),
      ]);
      feedMapped = payload.items
        .map((item, index) => mapFeedItemToEvent(item, index, "SF Funcheap"))
        .filter(Boolean);
      console.warn("[feed] mapped", feedMapped.length);
      feedStamp = payload.feed?.lastBuildDate
        ? new Date(payload.feed.lastBuildDate)
        : new Date();
    } catch (feedError) {
      console.warn("[feed] error", feedError);
    }

    let nineteenHzMapped = [];
    try {
      const nineteenHzItems = await Promise.race([
        fetch19hzListings(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("19hz request timed out")), 15000)
        ),
      ]);
      nineteenHzMapped = nineteenHzItems
        .map((item, index) => map19hzItemToEvent(item, index))
        .filter(Boolean);
      console.warn("[19hz] mapped", nineteenHzMapped.length);
    } catch (nineteenHzError) {
      console.warn("[19hz] error", nineteenHzError);
    }

    let poshMapped = [];
    try {
      poshMapped = await Promise.race([
        fetchPoshBayAreaListings(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Posh request timed out")), 15000)
        ),
      ]);
      console.warn("[posh] mapped", poshMapped.length);
    } catch (poshError) {
      console.warn("[posh] error", poshError);
    }

    let meetupMapped = [];
    try {
      const meetupItems = await Promise.race([
        fetchMeetupEvents(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Meetup request timed out")), 8000)
        ),
      ]);
      meetupMapped = meetupItems.map((item, index) => mapMeetupEventToEvent(item, index)).filter(Boolean);
      console.warn("[meetup] mapped", meetupMapped.length);
    } catch (meetupError) {
      console.warn("[meetup] error", meetupError);
    }

    let eventbriteMapped = [];
    try {
      const eventbriteItems = await Promise.race([
        fetchEventbriteEvents(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Eventbrite request timed out")), 8000)
        ),
      ]);
      eventbriteMapped = eventbriteItems.map((item, index) => mapEventbriteEventToEvent(item, index)).filter(Boolean);
      console.warn("[eventbrite] mapped", eventbriteMapped.length);
    } catch (eventbriteError) {
      console.warn("[eventbrite] error", eventbriteError);
    }

    let timeoutMapped = [];
    try {
      const timeoutItems = await Promise.race([
        fetchTimeoutSFEvents(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout SF request timed out")), 8000)
        ),
      ]);
      timeoutMapped = timeoutItems.map((item, index) => mapTimeoutSFArticleToEvent(item, index)).filter(Boolean);
      console.warn("[timeout] mapped", timeoutMapped.length);
    } catch (timeoutError) {
      console.warn("[timeout] error", timeoutError);
    }

    let mapped = [...listingMapped, ...feedMapped, ...nineteenHzMapped, ...poshMapped, ...meetupMapped, ...eventbriteMapped, ...timeoutMapped];
    mapped = await enrichFuncheapDates(mapped);
    mapped = enrichEventsWithCityLookup(mapped);

    state.allEvents = dedupeEvents(mapped);
    const debugTitle = "Drive-In Movie Night in Concord & San Jose";
    const debugEvent = state.allEvents.find((event) =>
      String(event.title || "").toLowerCase().includes(debugTitle.toLowerCase())
    );
    if (debugEvent) {
      console.warn("[debug] found event", debugEvent.title, debugEvent.date, {
        category: debugEvent.category,
        cost: debugEvent.cost,
      });
    } else {
      console.warn("[debug] event not found", debugTitle);
    }

    if (!state.allEvents.length) {
      state.allEvents = buildLocalFallbackEvents();
      state.deckMessage =
        "Live sources are temporarily unavailable. Showing sample events for now.";
    }
    const countSuffix = ` (SF Funcheap ${feedMapped.length + listingMapped.length}, 19hz ${nineteenHzMapped.length}, Posh ${poshMapped.length}, Meetup ${meetupMapped.length}, Eventbrite ${eventbriteMapped.length}, Timeout SF ${timeoutMapped.length})`;
    updateLastUpdated(
      Number.isNaN(feedStamp.getTime()) ? new Date() : feedStamp,
      countSuffix
    );
  } catch (error) {
    console.error("Unable to load live events:", error);
    state.allEvents = [];
    state.deckMessage =
      "Live events are currently unavailable. Please try again soon.";
    updateLastUpdated(new Date(), " (feed unavailable)");
  }

  refreshQueue();
}

function downloadICS(event) {
  const startDate = new Date(event.date);
  const safeStartDate = Number.isNaN(startDate.getTime()) ? new Date() : startDate;
  const endDate = new Date(safeStartDate.getTime() + 2 * 60 * 60 * 1000);
  const formatICS = (date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const escapeICSValue = (value) =>
    String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const sanitizeICSUrl = (value) =>
    String(value || "")
      .trim()
      .replace(/[\r\n]/g, "");

  const eventUid = escapeICSValue(event.id || `vuily-${safeStartDate.getTime()}`);
  const inviteUrl = sanitizeICSUrl(event.inviteUrl || "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Vuily//SF Events//EN",
    "BEGIN:VEVENT",
    `UID:${eventUid}@vuily.local`,
    `DTSTAMP:${formatICS(new Date())}`,
    `DTSTART:${formatICS(safeStartDate)}`,
    `DTEND:${formatICS(endDate)}`,
    `SUMMARY:${escapeICSValue(`Vuily | ${event.title || "Event"}`)}`,
    `LOCATION:${escapeICSValue(event.location)}`,
    `DESCRIPTION:${escapeICSValue(event.description)}`,
    ...(inviteUrl ? [`URL:${inviteUrl}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  const fileStem = String(event.title || "event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = `${fileStem || "event"}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

loadEvents();
renderSavedEvents();
updateScoreBoard();
