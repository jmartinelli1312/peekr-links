/**
 * Storage helpers for the Video Stories pipeline.
 *
 * Both buckets are private. Admins and the local worker reach objects only
 * through short-lived signed URLs minted server-side — there are no public
 * URLs for narration audio or unpublished video.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { VISUAL_TAGS } from "./types";

export const ASSETS_BUCKET = "video-story-assets";
export const OUTPUT_BUCKET = "video-story-output";

/** Default signed-URL lifetime: long enough to render, short enough to be safe. */
const DEFAULT_TTL_SECONDS = 60 * 60;

export async function signedUrl(
  admin: SupabaseClient,
  bucket: string,
  path: string,
  expiresIn: number = DEFAULT_TTL_SECONDS
): Promise<string | null> {
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Lists the generic b-roll available per visual tag. Tag = folder name inside
 * the assets bucket, so adding a tag's worth of footage is "create the folder,
 * drop the clips in" — no migration, no code change.
 */
/**
 * Vertical (TikTok) and horizontal (YouTube) keep independent libraries, so
 * each cut uses footage shot for its own frame instead of a crop of the other.
 */
export const ORIENTATIONS = ["vertical", "horizontal"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export async function listAssetsByTag(
  admin: SupabaseClient,
  orientation: Orientation = "vertical"
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};

  await Promise.all(
    VISUAL_TAGS.map(async (tag) => {
      const prefix = `${orientation}/${tag}`;
      // Sorted by name on purpose: the renderer walks this list in order, so
      // numbering the files (01_, 02_, …) is what controls the sequence.
      const { data, error } = await admin.storage.from(ASSETS_BUCKET).list(prefix, {
        limit: 200,
        sortBy: { column: "name", order: "asc" },
      });
      if (error || !data) {
        result[tag] = [];
        return;
      }
      result[tag] = data
        // Storage returns a placeholder row for empty folders; real objects
        // always carry an id.
        .filter((entry) => entry.id && /\.(mp4|mov|webm|jpg|jpeg|png|webp)$/i.test(entry.name))
        .map((entry) => `${prefix}/${entry.name}`);
    })
  );

  return result;
}

export function audioPath(storyId: string): string {
  return `${storyId}/narracion.m4a`;
}

export function videoPath(storyId: string): string {
  return `${storyId}/video.mp4`;
}

export function thumbnailPath(storyId: string): string {
  return `${storyId}/thumbnail.jpg`;
}

/** Caption timeline produced by the audio job and consumed by the video job. */
export function subtitlesPath(storyId: string): string {
  return `${storyId}/subtitulos.json`;
}
