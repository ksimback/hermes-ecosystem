import { kvGet, rateLimit } from "../lib/redis.js";

const MAX_DAYS = 365;
// Per-IP limit. This is the most expensive unauthenticated route (it fans out
// one Redis read per requested day), so cap how often a single IP can hit it.
const RATE_LIMIT = parseInt(process.env.STARS_HISTORY_RATE_LIMIT || "60", 10); // per minute per IP

export default async function handler(req, res) {
  try {
    const ip =
      req.headers["x-real-ip"]?.trim() ||
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      "unknown";
    const { allowed } = await rateLimit(`stars-history:ip:${ip}`, RATE_LIMIT, 60);
    if (!allowed) {
      return res.status(429).json({ days: 0, history: [], error: "Rate limit reached. Try again shortly." });
    }

    // Clamp the window. Without an upper bound, a request like ?days=1000000
    // would build a million date keys and fan them ALL out to Redis at once
    // (Promise.all), exhausting the function and the shared Redis instance.
    // parseInt(_, 10) also avoids accepting junk like "30abc" as a larger value.
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), MAX_DAYS);

    // Build date keys for the last N days
    const keys = [];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      keys.push(`stars:history:${d.toISOString().slice(0, 10)}`);
    }

    // Fetch all snapshots from Redis
    const snapshots = await Promise.all(
      keys.map(async (key) => {
        const data = await kvGet(key);
        return { date: key.replace("stars:history:", ""), data };
      })
    );

    // Filter out missing days and reverse to chronological order
    const history = snapshots
      .filter(s => s.data !== null)
      .reverse();

    return res.status(200).json({
      days: history.length,
      history,
    });
  } catch (err) {
    console.error("Stars history error:", err);
    // Don't cache the error response (vercel.json /api/(.*) sets s-maxage=3600)
    // and don't leak err.message to the client.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ days: 0, history: [] });
  }
}
