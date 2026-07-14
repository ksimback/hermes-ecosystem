import { kvGet, rateLimit } from "../lib/redis.js";

const MAX_DAYS = 365;
const DEFAULT_STALE_AFTER_MS = 36 * 60 * 60 * 1000;
const RATE_LIMIT = parseInt(process.env.STARS_HISTORY_RATE_LIMIT || "60", 10);

export function buildHistoryStatus(history, now = new Date(), staleAfterMs = DEFAULT_STALE_AFTER_MS) {
  const newest = history.at(-1) || null;
  const latestSnapshotAt = newest?.fetchedAt || (newest ? `${newest.date}T23:59:59.999Z` : null);
  const stale = !latestSnapshotAt || now.getTime() - Date.parse(latestSnapshotAt) > staleAfterMs;
  return {
    source: history.length > 0 ? "redis" : "unavailable",
    stale,
    latestSnapshotAt,
  };
}

export function createStarsHistoryHandler({
  kvGetImpl = kvGet,
  rateLimitImpl = rateLimit,
  now = () => new Date(),
} = {}) {
  return async function starsHistoryHandler(req, res) {
    try {
      const ip =
        req.headers["x-real-ip"]?.trim() ||
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        "unknown";
      const { allowed } = await rateLimitImpl(`stars-history:ip:${ip}`, RATE_LIMIT, 60);
      if (!allowed) {
        return res.status(429).json({
          source: "rate-limited",
          stale: true,
          days: 0,
          history: [],
          error: "Rate limit reached. Try again shortly.",
        });
      }

      const requestedDays = Math.min(
        Math.max(parseInt(req.query.days, 10) || 30, 1),
        MAX_DAYS,
      );
      const keys = [];
      const current = now();
      for (let offset = 0; offset < requestedDays; offset += 1) {
        const date = new Date(current);
        date.setUTCDate(date.getUTCDate() - offset);
        keys.push(`stars:history:${date.toISOString().slice(0, 10)}`);
      }

      const snapshots = await Promise.all(
        keys.map(async (key) => ({
          date: key.replace("stars:history:", ""),
          stored: await kvGetImpl(key),
        })),
      );
      const history = snapshots
        .filter((snapshot) => snapshot.stored !== null)
        .map(({ date, stored }) => ({
          date,
          fetchedAt: stored?.fetchedAt || null,
          data: stored?.data || stored,
        }))
        .reverse();
      const status = buildHistoryStatus(history, current);
      return res.status(200).json({
        ...status,
        requestedDays,
        days: history.length,
        coverage: history.length / requestedDays,
        history,
      });
    } catch (error) {
      console.error("Stars history error:", error);
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({
        source: "unavailable",
        stale: true,
        latestSnapshotAt: null,
        requestedDays: 0,
        days: 0,
        coverage: 0,
        history: [],
        error: "Star history unavailable",
      });
    }
  };
}

export default createStarsHistoryHandler();
