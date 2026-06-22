"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, ImageUp, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { addTenantRecordAction, type ActionState } from "@/lib/actions/admin";
import { getUploadSignatureAction } from "@/lib/actions/upload";
import type { BedOption } from "@/lib/db";

export function AddRecordDialog({ beds }: { beds: BedOption[] }) {
  return (
    <Modal
      title="New tenant record"
      description="Register a resident for the police record — no login needed."
      trigger={(open) => (
        <Button onClick={open}>
          <UserPlus className="size-4" /> Add tenant
        </Button>
      )}
    >
      {(close) => <RecordForm beds={beds} onDone={close} />}
    </Modal>
  );
}

function RecordForm({ beds, onDone }: { beds: BedOption[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addTenantRecordAction,
    {},
  );
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const options = beds.filter((b) => b.status === "vacant");

  const upload = async (file: File) => {
    setUploading(true);
    setUploadErr(null);
    try {
      const sig = await getUploadSignatureAction("pg360/kyc");
      if (!sig.ok) throw new Error(sig.error);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.apiKey);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: "POST", body: fd },
      );
      const json = (await res.json()) as { secure_url?: string };
      if (!json.secure_url) throw new Error("Upload failed");
      setPhoto(json.secure_url);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="aadhaar_photo_url" value={photo ?? ""} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Full name" htmlFor="name" className="col-span-2">
          <Input id="name" name="name" placeholder="Resident name" required />
        </FieldRow>
        <FieldRow label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" placeholder="9876543210" required />
        </FieldRow>
        <FieldRow label="Aadhaar / ID no." htmlFor="aadhaar_number">
          <Input id="aadhaar_number" name="aadhaar_number" placeholder="XXXX-XXXX-1234" />
        </FieldRow>
        <FieldRow label="Bed" htmlFor="bed_id" hint="rent auto-fills">
          <Select id="bed_id" name="bed_id" defaultValue="none">
            <option value="none">Unassigned</option>
            {options.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Check-in date" htmlFor="checkin_date">
          <Input id="checkin_date" name="checkin_date" type="date" required />
        </FieldRow>
        <FieldRow label="Security deposit (₹)" htmlFor="security_deposit" className="col-span-2">
          <Input id="security_deposit" name="security_deposit" type="number" min={0} placeholder="0" />
        </FieldRow>
      </div>

      {/* Aadhaar / ID photo */}
      <div className="rounded-xl border border-line bg-paper-2/50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          ID photo (Aadhaar / proof)
        </p>
        <div className="flex items-center gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="ID" className="size-16 rounded-lg border border-line object-cover" />
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
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-clay-600 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
            {photo ? "Replace photo" : "Upload photo"}
          </button>
        </div>
        {uploadErr && <p className="mt-1.5 text-xs text-rose-600">{uploadErr}</p>}
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending || uploading}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save record"
          )}
        </Button>
      </div>
    </form>
  );
}
