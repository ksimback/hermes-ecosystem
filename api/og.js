import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const SG = fetch(new URL("./fonts/SpaceGrotesk-Variable.ttf", import.meta.url)).then(r => r.arrayBuffer());
const JBM = fetch(new URL("./fonts/JetBrainsMono-Regular.ttf", import.meta.url)).then(r => r.arrayBuffer());

const MAX_TITLE = 120;
const MAX_SUBTITLE = 180;
const MAX_KIND = 40;

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "Hermes Atlas").slice(0, MAX_TITLE);
  const subtitle = (searchParams.get("subtitle") || "").slice(0, MAX_SUBTITLE);
  const kind = (searchParams.get("kind") || "").slice(0, MAX_KIND);

  const [sg, jbm] = await Promise.all([SG, JBM]);

  const kicker = kind ? `HERMES ATLAS · ${kind.toUpperCase()}` : "HERMES ATLAS";

  return new ImageResponse(
    {
      type: "div",
      props: {
        style: {
          width: "1200px",
          height: "630px",
          background: "#0e0d0b",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
          fontFamily: "Space Grotesk",
          color: "#e8e3d6",
          position: "relative",
        },
        children: [
          // H square (top-right brand mark)
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
          // Kicker
          {
            type: "div",
            props: {
              style: {
                fontFamily: "JetBrains Mono",
                fontSize: "24px",
                color: "#d49a4f",
                letterSpacing: "4px",
                marginBottom: "12px",
              },
              children: kicker,
            },
          },
          // Amber rule
          {
            type: "div",
            props: {
              style: {
                width: "80px",
                height: "3px",
                background: "#d49a4f",
                marginBottom: "40px",
              },
            },
          },
          // Title
          {
            type: "div",
            props: {
              style: {
                fontFamily: "Space Grotesk",
                fontSize: "68px",
                lineHeight: 1.1,
                color: "#e8e3d6",
                marginBottom: "24px",
                maxWidth: "1000px",
                display: "flex",
              },
              children: title,
            },
          },
          // Subtitle (optional)
          subtitle
            ? {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Space Grotesk",
                    fontSize: "28px",
                    lineHeight: 1.4,
                    color: "#b8b1a0",
                    maxWidth: "980px",
                    display: "flex",
                  },
                  children: subtitle,
                },
              }
            : null,
          // Footer URL
          {
            type: "div",
            props: {
              style: {
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
          },
        ].filter(Boolean),
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Space Grotesk", data: sg, weight: 700, style: "normal" },
        { name: "JetBrains Mono", data: jbm, weight: 400, style: "normal" },
      ],
    }
  );
}
