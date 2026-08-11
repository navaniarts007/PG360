"use client";

import { useActionState, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  ScrollText,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldRow, Input } from "@/components/ui/field";
import {
  getUploadSignatureAction,
  saveRulesDocumentAction,
} from "@/lib/actions/upload";

export function RulesRegulationsCard({
  rulesDocUrl,
}: {
  rulesDocUrl: string | null;
}) {
  const [state, action, pending] = useActionState(saveRulesDocumentAction, {});
  const [docUrl, setDocUrl] = useState<string | null>(rulesDocUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadErr(null);
    try {
      // 1. Try Cloudinary upload if configured
      const sig = await getUploadSignatureAction("pg360/docs");
      if (sig.ok) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("api_key", sig.apiKey);
        fd.append("timestamp", String(sig.timestamp));
        fd.append("signature", sig.signature);
        fd.append("folder", sig.folder);
        // auto upload endpoint handles images, PDFs, docs
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,
          { method: "POST", body: fd },
        );
        const json = (await res.json()) as { secure_url?: string; error?: { message: string } };
        if (!json.secure_url) throw new Error(json.error?.message ?? "Upload failed.");
        setDocUrl(json.secure_url);
      } else {
        // Fallback: create object URL / prompt for manual link
        throw new Error(sig.error || "Cloudinary upload not configured.");
      }
    } catch (e) {
      setUploadErr(
        e instanceof Error
          ? `${e.message} Please use the direct URL input below if direct file upload is unconfigured.`
          : "Upload failed.",
      );
      setShowUrlInput(true);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
          <ScrollText className="size-5" />
        </span>
        <div>
          <h3 className="text-lg text-ink">Rules &amp; Regulations</h3>
          <p className="text-sm text-ink-muted">
            Upload official house rules and guidelines document for residents.
          </p>
        </div>
      </div>

      <form action={action} className="mt-5 space-y-4">
        {state.error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
            <AlertCircle className="size-4 shrink-0" /> {state.error}
          </div>
        )}
        {state.ok && (
          <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3 text-sm font-medium text-teal-700">
            <CheckCircle2 className="size-4 shrink-0" /> Rules &amp; Regulations document saved successfully.
          </div>
        )}

        {/* Current Document View */}
        {docUrl ? (
          <div className="rounded-xl border border-line bg-paper-2/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-surface text-clay-600 ring-1 ring-line">
                  <FileText className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Rules &amp; Regulations Document</p>
                  <p className="truncate text-xs text-ink-muted max-w-xs">{docUrl}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-clay-600 hover:bg-paper-2"
                >
                  <ExternalLink className="size-3.5" /> View / Download
                </a>
                <button
                  type="button"
                  onClick={() => setDocUrl(null)}
                  className="grid size-8 place-items-center rounded-lg border border-line bg-surface text-ink-muted transition hover:bg-rose-50 hover:text-rose-600"
                  title="Remove document"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* File Upload Box */
          <div className="rounded-xl border border-dashed border-line-strong bg-paper-2/30 p-6 text-center">
            <UploadCloud className="mx-auto size-9 text-ink-muted" />
            <p className="mt-2 text-sm font-semibold text-ink">
              Upload Rules &amp; Regulations Document
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              PDF, DOC, DOCX, PNG, JPG (max 10MB)
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileUpload(f);
              }}
            />

            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-4" /> Select File
                  </>
                )}
              </Button>
            </div>

            {uploadErr && (
              <p className="mt-2 text-xs font-medium text-rose-600">{uploadErr}</p>
            )}
          </div>
        )}

        {/* Toggle / Manual Document URL input */}
        {(!docUrl || showUrlInput) && (
          <div className="pt-1">
            {!showUrlInput ? (
              <button
                type="button"
                onClick={() => setShowUrlInput(true)}
                className="text-xs font-semibold text-clay-600 hover:underline"
              >
                + Or enter document link (URL) manually
              </button>
            ) : (
              <FieldRow label="Document URL" htmlFor="rules_doc_url">
                <Input
                  id="rules_doc_url"
                  name="rules_doc_url"
                  value={docUrl ?? ""}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://example.com/rules-and-regulations.pdf"
                />
              </FieldRow>
            )}
          </div>
        )}

        <input type="hidden" name="rules_doc_url" value={docUrl ?? ""} />

        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save Rules & Regulations"
          )}
        </Button>
      </form>
    </Card>
  );
}
