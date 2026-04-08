import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;
const port = Number(process.env.PORT || 8000);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

const ALLOWED_PROXY_HOSTS = new Set([
  "sf.funcheap.com",
  "feeds.feedburner.com",
  "www.eventbrite.com",
  "www.meetup.com",
  "www.timeout.com",
  "19hz.info",
  "posh.vip",
]);

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function fetchUrl(targetUrl, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = targetUrl.startsWith("https:") ? https : http;
    const req = client.get(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    }, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location && redirects < 5) {
        const nextUrl = new URL(resp.headers.location, targetUrl).toString();
        resp.resume();
        resolve(fetchUrl(nextUrl, redirects + 1));
        return;
      }
      let data = "";
      resp.setEncoding("utf8");
      resp.on("data", (chunk) => {
        data += chunk;
      });
      resp.on("end", () => {
        resolve({
          status: resp.statusCode || 500,
          headers: resp.headers,
          body: data,
        });
      });
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/proxy") {
    const target = url.searchParams.get("url");
    if (!target) {
      return send(res, 400, { "Content-Type": "text/plain; charset=utf-8" }, "Missing url");
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch (error) {
      return send(res, 400, { "Content-Type": "text/plain; charset=utf-8" }, "Invalid url");
    }

    if (!ALLOWED_PROXY_HOSTS.has(parsed.hostname)) {
      return send(res, 403, { "Content-Type": "text/plain; charset=utf-8" }, "Host not allowed");
    }

    try {
      const response = await fetchUrl(parsed.toString());
      return send(
        res,
        response.status,
        {
          "Content-Type": response.headers["content-type"] || "application/xml; charset=utf-8",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
        response.body
      );
    } catch (error) {
      return send(res, 502, { "Content-Type": "text/plain; charset=utf-8" }, "Proxy fetch failed");
    }
  }

  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  filePath = path.join(root, decodeURIComponent(filePath));

  if (!filePath.startsWith(root)) {
    return send(res, 403, { "Content-Type": "text/plain; charset=utf-8" }, "Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      return send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || "application/octet-stream";
    return send(res, 200, { "Content-Type": type }, data);
  });
});

server.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
});
