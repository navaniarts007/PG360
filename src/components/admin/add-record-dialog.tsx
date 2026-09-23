"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, ImageUp, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { addTenantRecordAction, type ActionState } from "@/lib/actions/admin";
import { uploadKyc, uploadToStorage } from "@/lib/upload-client";
import { inr } from "@/lib/utils";
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
  const [selfie, setSelfie] = useState<string | null>(null); // check-in photo
  const [photo, setPhoto] = useState<string | null>(null); // ID document (private storage path)
  const [idPreview, setIdPreview] = useState<string | null>(null); // local preview of the ID
  const [busy, setBusy] = useState<null | "selfie" | "id">(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [stayType, setStayType] = useState<"monthly" | "daily">("monthly");
  const [dRate, setDRate] = useState(0);
  const [dDays, setDDays] = useState(0);
  const selfieRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onDone();
    }
  }, [state.ok, onDone, router]);

  const options = beds.filter((b) => b.status === "vacant");

  const upload = async (file: File, which: "selfie" | "id") => {
    setBusy(which);
    setUploadErr(null);
    try {
      // ID/Aadhaar → private, staff-only folder on the VPS.
      if (which === "id") {
        setIdPreview(URL.createObjectURL(file));
        setPhoto(await uploadKyc(file));
        return;
      }
      // Check-in selfie (not PII).
      setSelfie(await uploadToStorage(file, "pg360/avatars"));
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="aadhaar_photo_url" value={photo ?? ""} />
      <input type="hidden" name="avatar_url" value={selfie ?? ""} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      {/* check-in photo — take a live photo of the tenant */}
      <div className="flex items-center gap-4 rounded-xl border border-clay-100 bg-clay-50/40 p-4">
        {selfie ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selfie} alt="Tenant" className="size-20 rounded-xl object-cover ring-2 ring-clay-200" />
        ) : (
          <div className="grid size-20 place-items-center rounded-xl bg-paper text-ink-muted ring-1 ring-line">
            <Camera className="size-7" />
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">Check-in photo</p>
          <p className="mb-2 text-xs text-ink-muted">A quick photo of the tenant at check-in.</p>
          <input
            ref={selfieRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f, "selfie");
            }}
          />
          <button
            type="button"
            onClick={() => selfieRef.current?.click()}
            disabled={busy === "selfie"}
            className="inline-flex items-center gap-2 rounded-lg bg-clay-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-clay-700 disabled:opacity-60"
          >
            {busy === "selfie" ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {selfie ? "Retake photo" : "Take photo"}
          </button>
        </div>
      </div>

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
        <FieldRow label="Security deposit (₹)" htmlFor="security_deposit">
          <Input id="security_deposit" name="security_deposit" type="number" min={0} placeholder="0" />
        </FieldRow>
        <FieldRow label="Stay type" htmlFor="stay_type" className="col-span-2">
          <Select
            id="stay_type"
            name="stay_type"
            value={stayType}
            onChange={(e) => setStayType(e.target.value as "monthly" | "daily")}
          >
            <option value="monthly">Monthly</option>
            <option value="daily">Day-wise (fixed number of days)</option>
          </Select>
        </FieldRow>
        {stayType === "daily" && (
          <>
            <FieldRow label="Daily rate (₹)" htmlFor="daily_rate">
              <Input id="daily_rate" name="daily_rate" type="number" min={0} value={dRate || ""} onChange={(e) => setDRate(+e.target.value)} required />
            </FieldRow>
            <FieldRow label="Number of days" htmlFor="stay_days">
              <Input id="stay_days" name="stay_days" type="number" min={1} value={dDays || ""} onChange={(e) => setDDays(+e.target.value)} required />
            </FieldRow>
            <div className="col-span-2 flex items-center justify-between rounded-lg bg-ink px-4 py-2.5 text-paper">
              <span className="text-xs text-paper/70">Total for the stay ({dDays || 0} days)</span>
              <span className="font-display text-lg font-semibold tnum">{inr(dRate * dDays)}</span>
            </div>
          </>
        )}
      </div>

      {/* Aadhaar / ID photo */}
      <div className="rounded-xl border border-line bg-paper-2/50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          ID photo (Aadhaar / proof)
        </p>
        <div className="flex items-center gap-3">
          {idPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={idPreview} alt="ID" className="size-16 rounded-lg border border-line object-cover" />
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
              if (f) void upload(f, "id");
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy === "id"}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-clay-600 disabled:opacity-60"
          >
            {busy === "id" ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
            {photo ? "Replace photo" : "Upload photo"}
          </button>
        </div>
        {uploadErr && <p className="mt-1.5 text-xs text-rose-600">{uploadErr}</p>}
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending || busy !== null}>
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
