import { ImageResponse } from "@vercel/og";
import fs from "node:fs";
import path from "node:path";

const MAX_TITLE = 120;
const MAX_SUBTITLE = 180;
const MAX_KIND = 40;

let sgFont = null;
let jbmFont = null;

function loadFonts() {
  if (!sgFont) {
    sgFont = fs.readFileSync(path.join(process.cwd(), "api/fonts/SpaceGrotesk-Bold.ttf"));
  }
  if (!jbmFont) {
    jbmFont = fs.readFileSync(path.join(process.cwd(), "api/fonts/JetBrainsMono-Regular.ttf"));
  }
  return [sgFont, jbmFont];
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const title = (url.searchParams.get("title") || "Hermes Atlas").slice(0, MAX_TITLE);
    const subtitle = (url.searchParams.get("subtitle") || "").slice(0, MAX_SUBTITLE);
    const kind = (url.searchParams.get("kind") || "").slice(0, MAX_KIND);

    const [sg, jbm] = loadFonts();

    const kicker = kind ? `HERMES ATLAS · ${kind.toUpperCase()}` : "HERMES ATLAS";

    const children = [
      {
        type: "div",
        props: {
          style: {
            position: "absolute",
            top: "80px",
            right: "80px",
            width: "72px",
            height: "72px",
            background: "#d49a4f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Space Grotesk",
            fontSize: "56px",
            color: "#0e0d0b",
            lineHeight: 1,
          },
          children: "H",
        },
      },
      {
        type: "div",
        props: {
          style: {
            display: "flex",
            fontFamily: "JetBrains Mono",
            fontSize: "24px",
            color: "#d49a4f",
            letterSpacing: "4px",
            marginBottom: "12px",
          },
          children: kicker,
        },
      },
      {
        type: "div",
        props: {
          style: {
            display: "flex",
            width: "80px",
            height: "3px",
            background: "#d49a4f",
            marginBottom: "40px",
          },
          children: "",
        },
      },
      {
        type: "div",
        props: {
          style: {
            display: "flex",
            fontFamily: "Space Grotesk",
            fontSize: "68px",
            lineHeight: 1.1,
            color: "#e8e3d6",
            marginBottom: "24px",
            maxWidth: "1000px",
          },
          children: title,
        },
      },
    ];

    if (subtitle) {
      children.push({
        type: "div",
        props: {
          style: {
            display: "flex",
            fontFamily: "Space Grotesk",
            fontSize: "28px",
            lineHeight: 1.4,
            color: "#b8b1a0",
            maxWidth: "980px",
          },
          children: subtitle,
        },
      });
    }

    children.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          position: "absolute",
          bottom: "80px",
          left: "80px",
          fontFamily: "JetBrains Mono",
          fontSize: "22px",
          color: "#6b6355",
          letterSpacing: "2px",
        },
        children: "HERMESATLAS.COM",
      },
    });

    const element = {
      type: "div",
      props: {
        style: {
          width: "1200px",
          height: "630px",
          background: "#0e0d0b",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "Space Grotesk",
          color: "#e8e3d6",
          position: "relative",
        },
        children,
      },
    };

    const imageResponse = new ImageResponse(element, {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Space Grotesk", data: sg, weight: 700, style: "normal" },
        { name: "JetBrains Mono", data: jbm, weight: 400, style: "normal" },
      ],
    });

    // Convert Web Response → Node response
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.status(200).send(buffer);
  } catch (err) {
    console.error("[og] render failed:", err);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(500).send("OG render failed");
  }
}
