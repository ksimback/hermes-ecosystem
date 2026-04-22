const PUBLICATION_ID = "pub_cd668a5c-262b-4dd2-882b-6fb542d1a85a";
const BEEHIIV_URL = `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  if (!apiKey) {
    console.error("[subscribe] BEEHIIV_API_KEY not set");
    return json(res, 500, { ok: false, error: "Newsletter is temporarily unavailable." });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const email = String(body.email || "").trim().toLowerCase();
  const page = String(body.page || "").slice(0, 200);
  const referrer = String(body.referrer || "").slice(0, 400);

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return json(res, 400, { ok: false, error: "Enter a valid email." });
  }

  try {
    const upstream = await fetch(BEEHIIV_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: "hermesatlas.com",
        utm_medium: "organic",
        utm_campaign: page || "site",
        referring_site: referrer || "https://hermesatlas.com"
      })
    });

    if (upstream.ok) {
      return json(res, 200, { ok: true });
    }

    const text = await upstream.text();
    console.error(`[subscribe] Beehiiv ${upstream.status}: ${text.slice(0, 500)}`);

    if (upstream.status === 400) {
      return json(res, 400, { ok: false, error: "Enter a valid email." });
    }
    if (upstream.status === 429) {
      return json(res, 429, { ok: false, error: "Too many signups — try again in a minute." });
    }
    return json(res, 502, { ok: false, error: "Signup is temporarily unavailable. Try again?" });
  } catch (err) {
    console.error("[subscribe] fetch error:", err?.message || err);
    return json(res, 502, { ok: false, error: "Network error. Try again?" });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
