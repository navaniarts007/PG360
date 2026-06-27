"use client";

import { useRef, useState, useEffect } from "react";
import { Check, Eraser, ImageUp, Loader2, PenLine } from "lucide-react";
import { uploadSignature } from "@/lib/upload-client";

/** Capture a signature by drawing on a canvas OR uploading an image. On save it
 *  uploads privately and reports a "cld:" marker via onChange. */
export function SignaturePad({
  onChange,
  saved = false,
}: {
  onChange: (value: string | null) => void;
  saved?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(saved);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    dirty.current = true;
    setDone(false);
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    dirty.current = false;
    setDone(false);
    onChange(null);
  };

  const saveDrawn = async () => {
    if (!dirty.current) {
      setErr("Please draw your signature first.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const dataUrl = canvasRef.current!.toDataURL("image/png");
      const value = await uploadSignature(dataUrl);
      onChange(value);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      const value = await uploadSignature(file);
      onChange(value);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-line bg-white p-2">
        <canvas
          ref={canvasRef}
          width={520}
          height={170}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-[150px] w-full touch-none rounded-lg"
          style={{ touchAction: "none" }}
        />
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      {done && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-600">
          <Check className="size-3.5" /> Signature captured
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveDrawn}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-clay-600 px-3 py-2 text-sm font-semibold text-white hover:bg-clay-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />} Save signature
        </button>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-soft hover:text-clay-600"
        >
          <Eraser className="size-4" /> Clear
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-soft hover:text-clay-600 disabled:opacity-60"
        >
          <ImageUp className="size-4" /> Upload instead
        </button>
      </div>
    </div>
  );
}
