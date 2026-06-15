"use client";

import { useEffect } from "react";
import { useState } from "react";
import { X } from "lucide-react";

/**
 * Lightweight modal. Usage:
 *   <Modal trigger={(open) => <Button onClick={open}>Add</Button>} title="…">
 *     {(close) => <SomeForm onDone={close} />}
 *   </Modal>
 */
export function Modal({
  trigger,
  title,
  description,
  children,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  description?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {trigger(() => setOpen(true))}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-paper shadow-pop animate-rise sm:rounded-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-line bg-paper/95 px-6 py-5 backdrop-blur">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
                  {title}
                </h2>
                {description && (
                  <p className="mt-1 text-sm text-ink-muted">{description}</p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-paper-2 hover:text-ink"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6">{children(() => setOpen(false))}</div>
          </div>
        </div>
      )}
    </>
  );
}
