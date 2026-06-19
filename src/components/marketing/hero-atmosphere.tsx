"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

/** The hero's decorative background layers (dot grid, grain, two colour blobs),
 *  now drifting at different speeds as you scroll for a parallax depth effect.
 *  Purely decorative — no content. Falls back to static when reduced motion. */
export function HeroAtmosphere() {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();

  // each layer moves a different amount → depth
  const yGrid = useTransform(scrollY, [0, 700], [0, 90]);
  const yBlobA = useTransform(scrollY, [0, 700], [0, 160]);
  const yBlobB = useTransform(scrollY, [0, 700], [0, -120]);
  const sBlobA = useTransform(scrollY, [0, 700], [1, 1.15]);

  const off = reduced ? undefined : { y: yGrid };
  const blobA = reduced ? undefined : { y: yBlobA, scale: sBlobA };
  const blobB = reduced ? undefined : { y: yBlobB };

  return (
    <>
      <motion.div
        style={off}
        className="dotgrid pointer-events-none absolute inset-0 opacity-[0.5] [mask-image:radial-gradient(70%_55%_at_50%_30%,black,transparent)]"
      />
      <div className="grain pointer-events-none absolute inset-0" />
      <motion.div
        style={blobA}
        className="pointer-events-none absolute -top-40 right-[-10%] size-[34rem] rounded-full blur-3xl"
      >
        <div
          className="size-full rounded-full"
          style={{ background: "radial-gradient(circle, rgba(194,83,29,0.16), transparent 65%)" }}
        />
      </motion.div>
      <motion.div
        style={blobB}
        className="pointer-events-none absolute -bottom-40 left-[-10%] size-[30rem] rounded-full blur-3xl"
      >
        <div
          className="size-full rounded-full"
          style={{ background: "radial-gradient(circle, rgba(14,107,87,0.13), transparent 65%)" }}
        />
      </motion.div>
    </>
  );
}
