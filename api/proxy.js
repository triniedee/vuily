const ALLOWED_HOSTS = new Set([
  "sf.funcheap.com",
  "feeds.feedburner.com",
  "www.eventbrite.com",
  "www.meetup.com",
  "www.timeout.com",
  "19hz.info",
  "posh.vip",
]);

export default async function handler(req, res) {
  const { url: target } = req.query;
  if (!target) return res.status(400).send("Missing url");

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).send("Invalid url");
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return res.status(403).send("Host not allowed");
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    const data = await response.text();
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(response.status).send(data);
  } catch (err) {
    return res.status(502).send("Proxy fetch failed");
  }
}
