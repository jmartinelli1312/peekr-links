// Builds the ASS subtitle track that carries ALL on-screen text of the reel:
// hero cards, section headlines, word-by-word captions and the mid-roll
// follow / closing download cards. One track, one FFmpeg pass.
//
// Canvas: 1080×1920. Styles are Peekr-branded (magenta #CC0066 accent).

const W = 1080, H = 1920;

// ASS colours are &HAABBGGRR (alpha, blue, green, red).
const C = {
  white:   "&H00FFFFFF",
  magenta: "&H006600CC",     // #CC0066 → BB=66 GG=00 RR=CC
  black:   "&H00000000",
  shadow:  "&H80000000",
  dim:     "&H00B3B3B3",
};

function t(sec) {
  // ASS timestamp h:mm:ss.cc
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = (s % 60).toFixed(2).padStart(5, "0");
  return `${h}:${String(m).padStart(2, "0")}:${ss}`;
}

function esc(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")").replace(/\n/g, "\\N");
}

// Wrap long headlines onto up to 3 lines (~18 chars each) so hero text stays big.
function wrap(s, max = 18) {
  const words = String(s).split(/\s+/);
  const lines = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3).join("\\N");
}

export function buildAss({ timeline, words, handle = "@peekr.social", title = "" }) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hero,DejaVu Sans,96,${C.white},${C.white},${C.black},${C.shadow},-1,0,0,0,100,100,0,0,1,6,3,5,60,60,0,1
Style: HeroSub,DejaVu Sans,44,${C.magenta},${C.magenta},${C.black},${C.shadow},-1,0,0,0,100,100,2,0,1,4,2,5,60,60,0,1
Style: Head,DejaVu Sans,64,${C.white},${C.white},${C.black},${C.shadow},-1,0,0,0,100,100,0,0,1,5,3,8,60,60,700,1
Style: Cap,DejaVu Sans,58,${C.white},${C.white},${C.black},${C.shadow},-1,0,0,0,100,100,0,0,1,5,3,2,70,70,300,1
Style: CapHi,DejaVu Sans,58,${C.magenta},${C.magenta},${C.black},${C.shadow},-1,0,0,0,100,100,0,0,1,5,3,2,70,70,300,1
Style: Brand,DejaVu Sans,40,${C.magenta},${C.magenta},${C.black},${C.shadow},-1,0,0,0,100,100,1,0,1,3,2,3,0,50,60,1
Style: Card,DejaVu Sans,72,${C.white},${C.white},${C.black},${C.shadow},-1,0,0,0,100,100,0,0,1,6,3,5,80,80,0,1
Style: CardSub,DejaVu Sans,46,${C.dim},${C.dim},${C.black},${C.shadow},0,0,0,0,100,100,0,0,1,4,2,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const ev = [];
  const total = timeline[timeline.length - 1].end;

  // Persistent brand watermark (bottom-right) for the whole reel.
  ev.push(`Dialogue: 0,${t(0)},${t(total)},Brand,,0,0,0,,${esc(handle)}`);

  for (const seg of timeline) {
    const { kind, start, end, headline } = seg;

    if (kind === "hero_in") {
      // Big hook + title underneath, fade in/out.
      ev.push(`Dialogue: 1,${t(start)},${t(end)},Hero,,0,0,0,,{\\fad(250,250)}${wrap(headline)}`);
      if (title) ev.push(`Dialogue: 1,${t(start + 0.3)},${t(end)},HeroSub,,0,0,720,,{\\fad(250,250)}${esc(title.toUpperCase())}`);
      continue;
    }
    if (kind === "follow") {
      ev.push(`Dialogue: 1,${t(start)},${t(end)},Card,,0,0,0,,{\\fad(250,250)}¿TE GUSTA ESTE\\NCONTENIDO?`);
      ev.push(`Dialogue: 1,${t(start + 0.4)},${t(end)},CardSub,,0,0,-330,,{\\fad(250,250)}Sigue a ${esc(handle)}\\Npara más recomendaciones`);
      continue;
    }
    if (kind === "hero_out") {
      ev.push(`Dialogue: 1,${t(start)},${t(end)},Card,,0,0,0,,{\\fad(250,250)}DESCARGA PEEKR`);
      ev.push(`Dialogue: 1,${t(start + 0.4)},${t(end)},CardSub,,0,0,-330,,{\\fad(250,250)}Disponible en iOS y Android\\NDescubre qué ver`);
      continue;
    }

    // Narrated beats: section headline at the top, captions at the bottom.
    ev.push(`Dialogue: 1,${t(start)},${t(end)},Head,,0,0,0,,{\\fad(200,200)}${esc(headline.toUpperCase())}`);
  }

  // Word-by-word captions: show a rolling window of ~4 words, current word in magenta.
  const WINDOW = 4;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const s = w.s, e = (words[i + 1]?.s ?? w.e + 0.4);
    const from = Math.max(0, i - (i % WINDOW));
    const chunk = words.slice(from, from + WINDOW);
    const line = chunk.map((x) => (x === w ? `{\\rCapHi}${esc(x.w)}{\\rCap}` : esc(x.w))).join(" ");
    ev.push(`Dialogue: 2,${t(s)},${t(e)},Cap,,0,0,0,,${line}`);
  }

  return header + ev.join("\n") + "\n";
}
