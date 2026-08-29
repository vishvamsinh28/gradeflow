"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/components/ui/primitives";

/**
 * The night field behind the hero and the auth screens.
 *
 * Drawn rather than photographed: a deep gradient with a slow parallax star
 * field on canvas. It respects reduced-motion by rendering a single static
 * frame, and it is purely decorative.
 */
export function NightField({ className, density = 1 }: { className?: string; density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    let stars: { x: number; y: number; r: number; a: number; speed: number; phase: number }[] = [];

    function seed() {
      const count = Math.round(((width * height) / 9000) * density);
      stars = Array.from({ length: count }, (_, index) => {
        // Deterministic-ish spread so the field looks even rather than clumped.
        const golden = (index * 0.6180339887) % 1;
        return {
          x: golden * width,
          y: ((index * 0.7548776662) % 1) * height,
          r: 0.4 + ((index * 13) % 7) / 10,
          a: 0.25 + ((index * 7) % 10) / 16,
          speed: 0.006 + ((index * 3) % 5) / 900,
          phase: ((index * 11) % 100) / 16,
        };
      });
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function draw(time: number) {
      context!.clearRect(0, 0, width, height);
      for (const star of stars) {
        const twinkle = reduced ? 1 : 0.65 + 0.35 * Math.sin(time * star.speed + star.phase);
        context!.globalAlpha = star.a * twinkle;
        context!.fillStyle = "#ffffff";
        context!.beginPath();
        context!.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context!.fill();
      }
      context!.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(draw);
    }

    resize();
    draw(0);

    const observer = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [density, reduced]);

  return (
    <div className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      <div className="night-field absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="night-fade absolute inset-x-0 bottom-0 h-40" />
    </div>
  );
}

/** Marketing panel used beside the auth forms. */
export function NightPanel() {
  const lines = useMemo(
    () => [
      { name: "Aarav Shah", score: "34/40" },
      { name: "Ananya Iyer", score: "37/40" },
      { name: "Kabir Mehta", score: "29/40" },
      { name: "Priya Patel", score: "31/40" },
    ],
    [],
  );

  return (
    <div className="relative hidden overflow-hidden rounded-2xl lg:block">
      <NightField />
      <div className="relative flex h-full flex-col justify-between p-10">
        <p className="font-display text-[38px] text-white">
          A stack of papers in,
          <br />
          <span className="text-white/55">a full marks table out.</span>
        </p>

        <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-[12px] text-white/70">
            <span>Grading 24 submissions…</span>
            <span className="font-mono tnum">17/24</span>
          </div>
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-[71%] rounded-full bg-[#7fd6ab]" />
          </div>
          <ul className="mt-4 space-y-2">
            {lines.map((line) => (
              <li key={line.name} className="flex items-center justify-between text-[12.5px]">
                <span className="text-white/85">{line.name}</span>
                <span className="font-mono text-[#7fd6ab] tnum">{line.score}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
