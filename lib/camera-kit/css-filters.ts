/**
 * Built-in colour filters for the booth preview.
 *
 * These are plain CSS `filter` strings — nothing to do with Snap. They apply on
 * top of the live preview (and on top of an active Snap lens), and the exact
 * same string is set on the capture canvas's `ctx.filter` so the saved photo
 * matches what the guest saw. Because they are pure CSS they work even when
 * Camera Kit is unconfigured.
 *
 * Every value here must be valid in BOTH `element.style.filter` and
 * `CanvasRenderingContext2D.filter`, so stick to the colour primitives
 * (grayscale/sepia/saturate/contrast/brightness/hue-rotate). No `blur()` or
 * `drop-shadow()` — they render differently between the element and the canvas.
 */
export interface CssFilter {
  id: string;
  /** Accessible name + tooltip on the chip. */
  name: string;
  /** Shown in the chip (these filters ship no icon of their own). */
  emoji: string;
  /** Applied verbatim to `style.filter` and `ctx.filter`. */
  css: string;
}

export const CSS_FILTERS: CssFilter[] = [
  { id: "bw", name: "B&W", emoji: "⚫", css: "grayscale(1) contrast(1.08)" },
  { id: "noir", name: "Noir", emoji: "🎬", css: "grayscale(1) contrast(1.5) brightness(0.9)" },
  { id: "sepia", name: "Sepia", emoji: "🟤", css: "sepia(0.68) contrast(1.05) brightness(1.05)" },
  { id: "warm", name: "Warm", emoji: "☀️", css: "sepia(0.25) saturate(1.35) hue-rotate(-8deg) brightness(1.04)" },
  { id: "cool", name: "Cool", emoji: "🧊", css: "saturate(1.12) hue-rotate(14deg) brightness(1.03) contrast(1.05)" },
  { id: "vivid", name: "Vivid", emoji: "🌈", css: "saturate(1.6) contrast(1.16)" },
  { id: "fade", name: "Faded", emoji: "🌫️", css: "contrast(0.82) brightness(1.12) saturate(0.82) sepia(0.12)" },
];
