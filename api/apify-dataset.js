export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || !/^[a-zA-Z0-9]+$/.test(id)) {
    return res.status(400).json({ error: "Invalid dataset id" });
  }
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "APIFY_TOKEN not configured" });
  }
  const url = `https://api.apify.com/v2/datasets/${id}/items?token=${token}&format=json&clean=true&limit=1000`;
  try {
    const response = await fetch(url);
    const data = await response.text();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    return res.status(response.status).send(data);
  } catch (err) {
    return res.status(502).json({ error: "Apify fetch failed", detail: err.message });
  }
}
