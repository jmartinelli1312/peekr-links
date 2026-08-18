/**
 * Minimal WAV container writer.
 *
 * The TTS provider returns raw PCM; browsers need a RIFF header to play it.
 * The worker re-encodes to AAC with FFmpeg, so this only has to be correct
 * enough for <audio> playback of previews and the assembled narration.
 */

export function pcmToWav(
  pcm: Buffer,
  options: { sampleRate?: number; channels?: number; bitsPerSample?: number } = {}
): Buffer {
  const sampleRate = options.sampleRate ?? 24_000;
  const channels = options.channels ?? 1;
  const bitsPerSample = options.bitsPerSample ?? 16;

  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format: 1 = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

/** Seconds of audio in a raw PCM buffer. */
export function pcmDurationSeconds(
  byteLength: number,
  sampleRate = 24_000,
  channels = 1,
  bitsPerSample = 16
): number {
  const bytesPerSecond = (sampleRate * channels * bitsPerSample) / 8;
  return bytesPerSecond > 0 ? byteLength / bytesPerSecond : 0;
}
