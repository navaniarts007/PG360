"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileText, ImageUp, Loader2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { uploadKyc } from "@/lib/upload-client";
import { addTenantDocumentAction, deleteTenantDocumentAction, type ActionState } from "@/lib/actions/admin";
import { DOC_LABELS, type DocType, type TenantDocument } from "@/lib/types";

type SignedDoc = TenantDocument & { url: string | null };

export function DocumentsManager({ tenantId, docs }: { tenantId: string; docs: SignedDoc[] }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg text-ink">
          <FileText className="size-4.5 text-clay-500" /> ID documents
        </h3>
        <AddDocumentDialog tenantId={tenantId} />
      </div>

      {docs.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">No documents added yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {docs.map((d) => (
            <div key={d.id} className="overflow-hidden rounded-xl border border-line">
              {d.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.url} alt={DOC_LABELS[d.doc_type]} className="h-28 w-full bg-paper-2 object-contain" />
              ) : (
                <div className="grid h-28 place-items-center bg-paper-2 text-xs text-ink-muted">—</div>
              )}
              <div className="flex items-center justify-between gap-1 px-2.5 py-2">
                <span className="truncate text-xs font-semibold text-ink">
                  {d.label || DOC_LABELS[d.doc_type]}
                </span>
                <ConfirmDelete action={deleteTenantDocumentAction} id={d.id} title="Delete document" extra={{ tenant_id: tenantId }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AddDocumentDialog({ tenantId }: { tenantId: string }) {
  return (
    <Modal
      title="Add ID document"
      description="Aadhaar, driving license, passport, voter ID or other proof."
      trigger={(open) => (
        <Button variant="outline" onClick={open}>
          <Plus className="size-4" /> Add document
        </Button>
      )}
    >
      {(close) => <DocForm tenantId={tenantId} onDone={close} />}
    </Modal>
  );
}

function DocForm({ tenantId, onDone }: { tenantId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addTenantDocumentAction, {});
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onDone();
    }
  }, [state.ok, onDone, router]);

  const upload = async (file: File) => {
    setBusy(true);
    setUpErr(null);
    try {
      setPreview(URL.createObjectURL(file));
      setFileUrl(await uploadKyc(file));
    } catch (e) {
      setUpErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="file_url" value={fileUrl ?? ""} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Type" htmlFor="doc_type">
          <Select id="doc_type" name="doc_type" defaultValue="aadhaar">
            {(Object.keys(DOC_LABELS) as DocType[]).map((k) => (
              <option key={k} value={k}>{DOC_LABELS[k]}</option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Label (optional)" htmlFor="label">
          <Input id="label" name="label" placeholder="e.g. front side" />
        </FieldRow>
      </div>

      <div className="rounded-xl border border-line bg-paper-2/50 p-4">
        <div className="flex items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Document" className="size-16 rounded-lg border border-line object-cover" />
          ) : (
            <div className="grid size-16 place-items-center rounded-lg border border-dashed border-line-strong text-ink-muted">
              <ImageUp className="size-5" />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-soft hover:text-clay-600 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
            {fileUrl ? "Replace" : "Upload document"}
          </button>
        </div>
        {upErr && <p className="mt-1.5 text-xs text-rose-600">{upErr}</p>}
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>Cancel</Button>
        <Button type="submit" className="flex-1" disabled={pending || busy || !fileUrl}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Add document"}
        </Button>
      </div>
    </form>
  );
}
