// Client-side canvas → branded 9:16 story image for the Cinema IQ result.
// Everything is drawn (no external assets) so it renders instantly and never
// fails on a missing image. The exported PNG is what users post to IG Stories.

import type { QuizResult } from "./quiz-data";

const MAGENTA = "#FA0082";
const W = 1080;
const H = 1920;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the result card to a 1080x1920 canvas and returns a PNG blob. */
export async function buildResultImage(result: QuizResult): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background: archetype gradient.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, result.archetype.grad[0]);
  g.addColorStop(0.55, "#0D0D0D");
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  ctx.textAlign = "center";

  // Brand wordmark, top.
  ctx.fillStyle = MAGENTA;
  ctx.font = "900 68px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("PEEKR", cx, 170);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.fillText("CINEMA IQ TEST", cx, 224);

  // Archetype emoji.
  ctx.font = "200px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
  ctx.fillText(result.archetype.emoji, cx, 520);

  // "SOY UN…" label.
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "700 38px system-ui, sans-serif";
  ctx.fillText("SOY UN", cx, 620);

  // Archetype name (wrap up to 2 lines).
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 92px system-ui, sans-serif";
  const nameLines = wrap(ctx, result.archetype.name.toUpperCase(), W - 160);
  let ny = 720;
  for (const line of nameLines) {
    ctx.fillText(line, cx, ny);
    ny += 100;
  }

  // Tagline.
  ctx.fillStyle = MAGENTA;
  ctx.font = "italic 600 46px system-ui, sans-serif";
  ctx.fillText(result.archetype.tagline, cx, ny + 20);

  // Cinema IQ block.
  const boxY = ny + 110;
  const boxW = 720;
  const boxH = 340;
  const boxX = (W - boxW) / 2;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  roundRect(ctx, boxX, boxY, boxW, boxH, 40);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(250,0,130,0.5)";
  roundRect(ctx, boxX, boxY, boxW, boxH, 40);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillText("MI CINEMA IQ", cx, boxY + 90);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 190px system-ui, sans-serif";
  ctx.fillText(String(result.iq), cx, boxY + 260);

  // Percentile hook.
  ctx.fillStyle = MAGENTA;
  ctx.font = "800 44px system-ui, sans-serif";
  ctx.fillText(`Solo ${result.topPercent} llega a este nivel`, cx, boxY + boxH + 90);

  // Footer CTA.
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 46px system-ui, sans-serif";
  ctx.fillText("¿Cuál es el tuyo?", cx, H - 210);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "600 42px system-ui, sans-serif";
  ctx.fillText("peekr.app/quiz", cx, H - 148);
  ctx.fillStyle = MAGENTA;
  ctx.font = "800 40px system-ui, sans-serif";
  ctx.fillText("@peekr.oficial", cx, H - 90);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

/** Shares the image via the Web Share API (→ IG Stories on mobile), or
 * downloads it as a fallback. Returns true if native share was used. */
export async function shareResultImage(
  blob: Blob,
  text: string,
): Promise<boolean> {
  const file = new File([blob], "mi-cinema-iq.png", { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return true;
    } catch {
      // user cancelled or share failed → fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mi-cinema-iq.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return false;
}
