import { NextRequest, NextResponse } from "next/server";
import { requireWorker } from "@/lib/video-stories/worker-auth";
import { getTtsProvider } from "@/lib/video-stories/tts/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/video-stories/tts  (worker only)
 *
 * Synthesises one chunk and returns base64 PCM. This relay exists so the voice
 * key stays on the backend: the local worker assembles and encodes the audio
 * but never holds a provider credential.
 */
export async function POST(req: NextRequest) {
  const denied = requireWorker(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text : "";
  const voiceId = typeof body.voice_id === "string" ? body.voice_id : "";
  const style = typeof body.style === "string" ? body.style : undefined;

  if (!text.trim() || !voiceId) {
    return NextResponse.json({ error: "text y voice_id son obligatorios" }, { status: 400 });
  }

  try {
    const provider = await getTtsProvider();
    const result = await provider.synthesize({ text, voiceId, style });

    return NextResponse.json({
      pcm_base64: result.pcm.toString("base64"),
      sample_rate: result.sampleRate,
      channels: result.channels,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
