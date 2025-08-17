// functions/index.js
const functions = require("firebase-functions");
const fetch = global.fetch || require("node-fetch");

exports.getGames = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).send("");

    try {
      const upstream = "https://www.freetogame.com/api/games?platform=browser";
      const r = await fetch(upstream);
      if (!r.ok) return res.status(r.status).send(await r.text());
      const data = await r.json();
      return res.status(200).json(data);
    } catch (err) {
      console.error("getGames proxy error:", err);
      return res.status(500).json({ error: err.message || "Unknown error" });
    }
  });
