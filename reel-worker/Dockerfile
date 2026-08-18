# Peekr reel worker — turns a title_reels row into a vertical 9:16 MP4.
# Lives on Railway because it needs FFmpeg, yt-dlp and Whisper (minutes of CPU,
# ~500 MB of tools) — none of which fit a Vercel function.
FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates curl python3 python3-pip fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

# yt-dlp: standalone binary (no pip dance, always current).
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

# faster-whisper for word-level caption timing (CPU, small model).
RUN pip3 install --no-cache-dir --break-system-packages faster-whisper==1.0.3

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY src ./src
COPY assets ./assets

# Pre-download the whisper model at build time so first job isn't slow.
RUN python3 -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

ENV NODE_ENV=production
CMD ["node", "src/index.mjs"]
