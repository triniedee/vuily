const SF_OPEN_DATA_EVENTS_ENDPOINT =
  "https://data.sfgov.org/resource/8i3s-ih2a.json?$limit=200&$order=:updated_at DESC";

const FALLBACK_EVENTS = [
  {
    id: "evt-1",
    title: "Night Market at Fort Mason",
    category: "Cultural",
    cost: "Free",
    date: "2026-04-12T19:00:00",
    location: "Fort Mason Center",
    description:
      "Street food, neon art stalls, and DJs spinning global beats for grown-up night owls.",
  },
  {
    id: "evt-2",
    title: "Sunset Sketch + Wine Walk",
    category: "Arts",
    cost: "Budget",
    date: "2026-04-16T18:30:00",
    location: "Lands End Lookout",
    description:
      "A guided outdoor sketch session with local artists and a tasting flight at golden hour.",
  },
  {
    id: "evt-3",
    title: "Afro-Latin Rooftop Dance Jam",
    category: "Music",
    cost: "Moderate",
    date: "2026-04-18T20:00:00",
    location: "SoMa Rooftop Collective",
    description:
      "Live percussion, dance coaches, and a playful social dance floor under city lights.",
  },
  {
    id: "evt-4",
    title: "Bioluminescent Kayak Meetup",
    category: "Outdoors",
    cost: "Premium",
    date: "2026-04-20T21:00:00",
    location: "Mission Creek Marina",
    description:
      "Guided evening paddle, glowing water trails, and a post-tour cocoa lounge.",
  },
  {
    id: "evt-5",
    title: "Speakeasy Jazz Story Night",
    category: "Music",
    cost: "Budget",
    date: "2026-04-23T20:30:00",
    location: "North Beach Social Club",
    description:
      "Intimate jazz sets paired with hilarious storytelling from Bay Area performers.",
  },
  {
    id: "evt-6",
    title: "Murals + Mocktails Cycling Tour",
    category: "Outdoors",
    cost: "Moderate",
    date: "2026-04-25T11:00:00",
    location: "Mission District",
    description:
      "A cheerful bike route through iconic murals with vibrant zero-proof drink stops.",
  },
  {
    id: "evt-7",
    title: "Avant-Garden Costume Party",
    category: "Arts",
    cost: "Premium",
    date: "2026-04-28T19:30:00",
    location: "Civic Center Greenhouse",
    description:
      "Whimsical costume challenge with projection art, interactive theater, and prizes.",
  },
  {
    id: "evt-8",
    title: "Comedy + Culture Museum Late",
    category: "Cultural",
    cost: "Free",
    date: "2026-04-30T18:00:00",
    location: "Yerba Buena Arts Hall",
    description:
      "After-hours exhibits, pop-up standup, and playful conversations for curious adults.",
  },
];

const state = {
  category: "all",
  cost: "all",
  allEvents: [],
  queue: [],
  reserved: [],
  reviews: {},
  points: 0,
  streak: 0,
};

const cardDeck = document.getElementById("cardDeck");
const categoryFilter = document.getElementById("categoryFilter");
const costFilter = document.getElementById("costFilter");
const skipBtn = document.getElementById("skipBtn");
const reserveBtn = document.getElementById("reserveBtn");
const savedEvents = document.getElementById("savedEvents");
const pointsEl = document.getElementById("points");
const streakEl = document.getElementById("streak");
const levelEl = document.getElementById("level");
const badgeEl = document.getElementById("badge");

categoryFilter.addEventListener("change", () => {
  state.category = categoryFilter.value;
  refreshQueue();
});

costFilter.addEventListener("change", () => {
  state.cost = costFilter.value;
  refreshQueue();
});

skipBtn.addEventListener("click", () => swipeTopCard("left"));
reserveBtn.addEventListener("click", () => swipeTopCard("right"));

function filterEvents() {
  return state.allEvents.filter((event) => {
    const categoryMatch =
      state.category === "all" || event.category === state.category;
    const costMatch = state.cost === "all" || event.cost === state.cost;
    const notReserved = !state.reserved.find((entry) => entry.id === event.id);
    return categoryMatch && costMatch && notReserved;
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
        No events left for this filter. Try another category or cost range.
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
  card.className = "event-card";
  card.dataset.id = event.id;
  card.style.transform = `translateY(${depth * 7}px) scale(${1 - depth * 0.03})`;
  card.style.zIndex = `${10 - depth}`;

  const date = new Date(event.date);
  const prettyDate = date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  card.innerHTML = `
    <span class="swipe-tag pass">PASS</span>
    <span class="swipe-tag reserve">RESERVE</span>
    <h3>${event.title}</h3>
    <div class="event-meta">
      <span class="pill">${event.category}</span>
      <span class="pill cost-${event.cost}">${costLabel(event.cost)}</span>
    </div>
    <p><strong>When:</strong> ${prettyDate}</p>
    <p><strong>Where:</strong> ${event.location}</p>
    <p class="event-desc">${event.description}</p>
  `;

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
    isDragging = true;
    startX = event.clientX;
    card.setPointerCapture(event.pointerId);
  });

  card.addEventListener("pointermove", (event) => {
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

function swipeTopCard(direction) {
  if (!state.queue.length) {
    return;
  }
  handleDecision(state.queue[0].id, direction);
}

function handleDecision(eventId, direction) {
  const selected = state.queue.find((event) => event.id === eventId);
  if (!selected) {
    return;
  }

  if (direction === "right") {
    state.reserved.push(selected);
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
  if (!state.reserved.length) {
    savedEvents.innerHTML = `
      <div class="empty-state">
        Reserve events to build your playful weekend plan.
      </div>
    `;
    return;
  }

  state.reserved.forEach((event) => {
    const item = document.createElement("article");
    item.className = "saved-card";
    const review = state.reviews[event.id] || "";

    item.innerHTML = `
      <h3>${event.title}</h3>
      <p class="saved-meta">${event.category} • ${costLabel(event.cost)} • ${prettyDate(event.date)}</p>
      <div class="saved-actions">
        <button class="tiny-btn calendar" data-action="calendar" data-id="${event.id}">Add to Calendar</button>
        <button class="tiny-btn ${review === "up" ? "active-up" : ""}" data-action="up" data-id="${event.id}">Thumbs Up</button>
        <button class="tiny-btn ${review === "down" ? "active-down" : ""}" data-action="down" data-id="${event.id}">Thumbs Down</button>
      </div>
    `;
    savedEvents.appendChild(item);
  });
}

savedEvents.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
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
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

function pickString(record, keys, fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function pickDate(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (!value) {
      continue;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return "";
}

function normalizeCategory(rawText) {
  const text = rawText.toLowerCase();
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

function looksAdultFriendly(text) {
  const lowered = text.toLowerCase();
  const youthTerms = [
    "children",
    "child",
    "kids",
    "teen",
    "youth",
    "family",
    "families",
    "toddler",
    "parent-child",
  ];
  return !youthTerms.some((term) => lowered.includes(term));
}

function mapRecordToEvent(record, index) {
  const title = pickString(record, [
    "title",
    "event_name",
    "name",
    "activity_name",
    "service_name",
  ]);
  const description = pickString(record, [
    "description",
    "activity_description",
    "details",
    "service_description",
    "notes",
  ]);
  const date = pickDate(record, [
    "start_datetime",
    "start_date",
    "event_start",
    "date",
  ]);
  const location = pickString(record, [
    "location_name",
    "venue_name",
    "location",
    "address",
    "location_address",
    "neighborhood",
  ]);
  const categoryText = pickString(record, [
    "category",
    "activity_category",
    "tags",
    "service_type",
    "event_type",
  ]);
  const costText = pickString(record, ["cost", "price", "fee", "payment_info"]);
  const adultSignal = [title, description, categoryText, location].join(" ");

  if (!title || !date || !looksAdultFriendly(adultSignal)) {
    return null;
  }

  return {
    id: `sf-${record.id || record._id || index}`,
    title,
    category: normalizeCategory(`${categoryText} ${title} ${description}`),
    cost: normalizeCost(costText),
    date,
    location: location || "San Francisco",
    description:
      description ||
      "Live event in San Francisco. Open details to check exact attendance rules.",
  };
}

function isFutureEvent(event) {
  const now = Date.now();
  const eventTime = new Date(event.date).getTime();
  return Number.isFinite(eventTime) && eventTime >= now;
}

async function loadEvents() {
  setDeckMessage("Loading live San Francisco events...");
  try {
    const response = await fetch(SF_OPEN_DATA_EVENTS_ENDPOINT);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const raw = await response.json();
    const mapped = raw
      .map((record, index) => mapRecordToEvent(record, index))
      .filter(Boolean)
      .filter(isFutureEvent);

    state.allEvents = mapped.length ? mapped : FALLBACK_EVENTS;
  } catch (error) {
    console.error("Falling back to local events:", error);
    state.allEvents = FALLBACK_EVENTS;
  }

  refreshQueue();
}

function downloadICS(event) {
  const startDate = new Date(event.date);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  const formatICS = (date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vuily//SF Events//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@vuily.local`,
    `DTSTAMP:${formatICS(new Date())}`,
    `DTSTART:${formatICS(startDate)}`,
    `DTEND:${formatICS(endDate)}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.location}`,
    `DESCRIPTION:${event.description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${event.title.toLowerCase().replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

loadEvents();
renderSavedEvents();
updateScoreBoard();
