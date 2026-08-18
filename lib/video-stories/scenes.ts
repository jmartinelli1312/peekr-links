/**
 * Scene planning: splits an approved script into scenes and assigns b-roll.
 *
 * The b-roll deliberately does NOT illustrate the story. In this format the
 * narration carries the plot while the screen shows unrelated high-stimulus
 * footage (things opening, being made, being poured). So there is no model
 * call here and no mood matching — scenes are an even split of the narration,
 * and clips are handed out so no two neighbours repeat.
 *
 * Dropping the AI pass also removed a per-render model call and its latency.
 */

import { VISUAL_TAGS, type Scene, type VisualTag } from "./types";

const MIN_SCENES = 3;
const MAX_SCENES = 200;

/**
 * Words per scene.
 *
 * At the measured effective rate (~4.3 words per second of finished video)
 * this is about ten seconds — roughly as long as one stock clip holds
 * attention. It used to be 90 words, and capped at two scenes per available
 * clip, which produced 20-40 second shots: the single biggest reason the
 * footage looked like it repeated.
 *
 * This is only an estimate, because the real speaking rate isn't known until
 * the narration exists. The worker measures it and subdivides any shot that
 * still comes out too long, so being wrong here costs nothing.
 */
const WORDS_PER_SCENE = 45;

function sceneCountFor(wordCount: number): number {
  const byLength = Math.floor(wordCount / WORDS_PER_SCENE);
  return Math.max(MIN_SCENES, Math.min(MAX_SCENES, byLength || 1));
}

/**
 * Splits the narration into equal scenes and rotates the categories.
 *
 * Rotation (not random choice) guarantees neighbours never share a category.
 * The tag is a starting preference — `assignAssets` has the final say, since
 * only it knows how much footage each category actually holds.
 */
export function planScenes(
  script: string,
  availableTags: VisualTag[] = [...VISUAL_TAGS]
): Scene[] {
  const words = script.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const tags = availableTags.length > 0 ? availableTags : [...VISUAL_TAGS];
  const count = sceneCountFor(words.length);
  const perScene = Math.ceil(words.length / count);

  const scenes: Scene[] = [];
  for (let i = 0; i < count; i++) {
    const slice = words.slice(i * perScene, (i + 1) * perScene);
    if (slice.length === 0) break;
    scenes.push({
      index: scenes.length,
      text: slice.join(" "),
      tag: tags[scenes.length % tags.length],
    });
  }
  return scenes;
}

/**
 * Assigns a concrete clip to each scene.
 *
 * Least-used-first across the whole library, not a per-category cursor. The
 * cursor version rotated categories evenly, which meant a folder holding two
 * clips got as many scenes as one holding ten — those two clips then carried a
 * quarter of the video. Picking the least-used clip spreads the load in
 * proportion to what exists, and ties break towards changing category so
 * neighbours still look different.
 *
 * `assetsByTag` comes from listing the video-story-assets bucket. Categories
 * with nothing uploaded simply contribute nothing, so a partly populated
 * bucket still renders.
 */
export function assignAssets(
  scenes: Scene[],
  assetsByTag: Record<string, string[]>
): Scene[] {
  const clips = Object.entries(assetsByTag).flatMap(([tag, paths]) =>
    paths.map((path) => ({ path, tag: tag as VisualTag, uses: 0 }))
  );
  if (clips.length === 0) return scenes;

  let previous: (typeof clips)[number] | undefined;

  return scenes.map((scene) => {
    // Never the same clip twice in a row, unless it's the only one there is.
    const candidates = clips.length > 1 ? clips.filter((c) => c !== previous) : clips;

    let best = candidates[0];
    for (const clip of candidates) {
      if (clip.uses !== best.uses) {
        if (clip.uses < best.uses) best = clip;
        continue;
      }
      // Same usage count: prefer a different category, then the scene's own.
      const bestChanges = best.tag !== previous?.tag;
      const clipChanges = clip.tag !== previous?.tag;
      if (clipChanges && !bestChanges) best = clip;
      else if (clipChanges === bestChanges && clip.tag === scene.tag && best.tag !== scene.tag) {
        best = clip;
      }
    }

    best.uses++;
    previous = best;
    return { ...scene, tag: best.tag, asset: best.path };
  });
}
