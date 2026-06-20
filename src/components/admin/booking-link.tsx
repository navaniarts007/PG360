"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";

/** Shows the property's public booking link with copy + open actions. */
export function BookingLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can still select the text */
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
          <Link2 className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Your public booking link</p>
          <p className="text-xs text-ink-muted">Share it anywhere — requests land here.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <code className="max-w-[16rem] truncate rounded-lg border border-line bg-paper-2/60 px-3 py-2 font-mono text-xs text-ink-soft">
          {url}
        </code>
        <button
          onClick={copy}
          title="Copy link"
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-2 text-xs font-semibold text-paper transition-colors hover:bg-ink-soft"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open booking page"
          className="grid size-9 place-items-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-paper-2 hover:text-clay-600"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>
    </div>
  );
}
