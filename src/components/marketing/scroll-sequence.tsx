"use client";

import { useEffect, useRef, useState } from "react";
import { useScroll, useMotionValueEvent, useReducedMotion } from "framer-motion";

/**
 * Apple-style scrollytelling: a video exported to a numbered frame sequence,
 * drawn to a <canvas> and scrubbed by scroll. The section is pinned for
 * `pinVh` viewport-heights; scrolling through it plays the clip frame-by-frame.
 *
 * Frames live at `srcFor(i)` for i in [1..frameCount], e.g.
 *   /frames/hero/0001.webp … /frames/hero/0300.webp
 * Generate them with `node scripts/extract-frames.mjs <video.mp4>`.
 */
export function ScrollSequence({
  frameCount,
  srcFor,
  pinVh = 320,
  className,
  children,
}: {
  frameCount: number;
  srcFor: (i: number) => string;
  pinVh?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [ready, setReady] = useState(false);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // preload every frame
  useEffect(() => {
    let alive = true;
    let loaded = 0;
    const imgs: HTMLImageElement[] = [];
    for (let i = 1; i <= frameCount; i++) {
      const img = new Image();
      img.src = srcFor(i);
      img.onload = img.onerror = () => {
        if (!alive) return;
        loaded += 1;
        if (loaded === 1) draw(0); // show first frame asap
        if (loaded >= Math.min(frameCount, 8)) setReady(true);
      };
      imgs[i - 1] = img;
    }
    imagesRef.current = imgs;
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameCount]);

  const draw = (index: number) => {
    const canvas = canvasRef.current;
    const img = imagesRef.current[Math.max(0, Math.min(frameCount - 1, Math.round(index)))];
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // cover
    const r = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * r;
    const dh = img.naturalHeight * r;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  };

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (reduce) return;
    draw(p * (frameCount - 1));
  });

  useEffect(() => {
    const onResize = () => draw(scrollYProgress.get() * (frameCount - 1));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameCount]);

  return (
    <section ref={sectionRef} style={{ height: `${pinVh}vh` }} className={className}>
      <div className="sticky top-0 flex h-dvh items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} className="h-full w-full" />
        {!ready && (
          <div className="absolute inset-0 grid place-items-center bg-paper">
            <div className="size-8 animate-spin rounded-full border-2 border-line border-t-clay-500" />
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
