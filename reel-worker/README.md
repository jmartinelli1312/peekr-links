# Peekr reel worker (Railway)

Renders `title_reels` rows (status `queued`) into 9:16 MP4s:
trailer clips (muted, blurred-bg fill) + ElevenLabs voice (via fal.ai) +
word-by-word captions (Whisper) + brand cards → uploads to the `reels` bucket.

## Deploy on Railway (one time)

1. Railway → **New Project → Deploy from GitHub repo** → pick `peekr-links`,
   set **Root Directory** = `reel-worker`. (Dockerfile is auto-detected.)
2. Variables (Settings → Variables):

   | Var | Value |
   |---|---|
   | `SUPABASE_URL` | `https://glorjiffzccygrhtvnyc.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role key |
   | `FAL_KEY` | fal.ai key (ElevenLabs runs through fal) |
   | `REEL_VOICE` | optional — ElevenLabs voice name/id (default `Valentina`, LatAm female) |
   | `REEL_MUSIC_URL` | optional — public MP3 for the background bed (royalty-free) |
   | `POLL_MS` | optional — default `15000` |

3. Deploy. First build takes ~5 min (installs FFmpeg, yt-dlp, Whisper `small`).
   Logs should print `reel worker up — voice=… poll=…`.

No web port needed — it's a poll loop. Railway's cheapest plan is enough
(≈1 vCPU / 1 GB; a 40 s reel renders in ~2–4 min).

## Flow

```
Editorial tab → "Generar reel de hoy"  (Vercel: pick title, TMDB facts, AI script)
        ↓ review / edit script
   "Renderizar"  → status=queued  → this worker → status=ready (video_url)
        ↓ preview in tab
 "Enviar al IG"  → peekrbuzz_ig_queue (draft_type=reel, pending_review)
        ↓ Aprobar (same button as carousels)
   social_publisher → IG Graph API media_type=REELS
```

## Voice

Set `REEL_VOICE` to any ElevenLabs premade voice. Good LatAm-Spanish female
options to A/B in the first days: `Valentina`, `Lucía`, `Sofia`. Voice is also
stored per reel (`title_reels.voice_id`) so past reels re-render identically.

## Background music

Drop a royalty-free MP3 in Supabase Storage (public) and put its URL in
`REEL_MUSIC_URL`. It's mixed at 12% under the voice and faded out. Leave unset
for voice-only.
