"use client";

import { useEffect, useRef } from "react";

import { FACE_LENSES } from "@/lib/ar";
import { drawFaceLens } from "@/lib/ar/draw";

/**
 * TEMPORARY dev harness: renders every face lens against a synthetic face mesh
 * so the drawings can be eyeballed without a camera. Delete once checked.
 */
const W = 260;
const H = 260;

/** A plausible upright face, only at the indices `draw.ts` reads. */
function fakeFace() {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (i: number, x: number, y: number) => (lm[i] = { x, y, z: 0 });
  set(33, 0.36, 0.44); // eye outer A
  set(263, 0.64, 0.44); // eye outer B
  set(133, 0.45, 0.44); // eye inner A
  set(362, 0.55, 0.44); // eye inner B
  set(1, 0.5, 0.56); // nose tip
  set(152, 0.5, 0.8); // chin
  set(10, 0.5, 0.22); // forehead top
  set(61, 0.42, 0.68); // mouth left
  set(291, 0.58, 0.68); // mouth right
  set(13, 0.5, 0.655); // upper lip
  set(234, 0.3, 0.52); // face left
  set(454, 0.7, 0.52); // face right
  return lm;
}

export default function DevFilters() {
  const refs = useRef(new Map<string, HTMLCanvasElement>());

  useEffect(() => {
    const lm = fakeFace();
    for (const lens of FACE_LENSES) {
      const c = refs.current.get(lens.id);
      const ctx = c?.getContext("2d");
      if (!ctx) continue;
      ctx.clearRect(0, 0, W, H);
      // A face-ish oval underneath, so props can be judged in place.
      ctx.fillStyle = "#d8b48c";
      ctx.beginPath();
      ctx.ellipse(W / 2, H * 0.52, W * 0.2, H * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      try {
        drawFaceLens(ctx, lm, lens.id, W, H, 1200);
      } catch (err) {
        ctx.fillStyle = "red";
        ctx.font = "14px monospace";
        ctx.fillText("THREW", 10, 20);
        console.error(lens.id, err);
      }
    }
  }, []);

  return (
    <main style={{ background: "#2b2b2b", padding: 16, minHeight: "100vh" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {FACE_LENSES.map((lens) => (
          <div key={lens.id} style={{ textAlign: "center", color: "#eee" }}>
            <canvas
              ref={(el) => {
                if (el) refs.current.set(lens.id, el);
              }}
              width={W}
              height={H}
              style={{ background: "#4a5b6b", borderRadius: 8, display: "block" }}
            />
            <div style={{ font: "12px sans-serif", marginTop: 2 }}>{lens.name}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
