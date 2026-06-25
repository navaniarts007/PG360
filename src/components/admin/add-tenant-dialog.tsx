"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, ImageUp, Loader2, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import {
  addTenantAction,
  updateTenantAction,
  type ActionState,
} from "@/lib/actions/admin";
import { getUploadSignatureAction } from "@/lib/actions/upload";
import type { BedOption } from "@/lib/db";
import type { Tenant } from "@/lib/types";

export function AddTenantDialog({
  beds,
  tenant,
}: {
  beds: BedOption[];
  tenant?: Tenant;
}) {
  const isEdit = !!tenant;
  return (
    <Modal
      title={isEdit ? `Edit ${tenant.name}` : "Add a tenant"}
      description={
        isEdit
          ? "Rent follows the assigned bed."
          : "Pick a bed — rent auto-fills, and the resident gets a login."
      }
      trigger={(open) =>
        isEdit ? (
          <button
            onClick={open}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-paper-2 hover:text-clay-600"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
        ) : (
          <Button onClick={open}>
            <UserPlus className="size-4" /> Add tenant
          </Button>
        )
      }
    >
      {(close) => <TenantForm beds={beds} tenant={tenant} onDone={close} />}
    </Modal>
  );
}

function TenantForm({
  beds,
  tenant,
  onDone,
}: {
  beds: BedOption[];
  tenant?: Tenant;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    tenant ? updateTenantAction : addTenantAction,
    {},
  );
  const [selfie, setSelfie] = useState<string | null>(tenant?.avatar_url ?? null); // check-in photo
  const [photo, setPhoto] = useState<string | null>(tenant?.aadhaar_photo_url ?? null); // ID document
  const [busy, setBusy] = useState<null | "selfie" | "id">(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onDone();
    }
  }, [state.ok, onDone, router]);

  const options = beds.filter((b) => b.status === "vacant" || b.id === tenant?.bed_id);

  const upload = async (file: File, which: "selfie" | "id") => {
    setBusy(which);
    setUploadErr(null);
    try {
      const sig = await getUploadSignatureAction(which === "selfie" ? "pg360/avatars" : "pg360/kyc");
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
      (which === "selfie" ? setSelfie : setPhoto)(json.secure_url);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <form action={action} className="space-y-4">
      {tenant && <input type="hidden" name="id" value={tenant.id} />}
      <input type="hidden" name="avatar_url" value={selfie ?? ""} />
      <input type="hidden" name="aadhaar_photo_url" value={photo ?? ""} />
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
          <Input id="name" name="name" defaultValue={tenant?.name ?? ""} placeholder="Arjun Nair" required />
        </FieldRow>
        <FieldRow label="Bed" htmlFor="bed_id" hint="rent auto-fills" className="col-span-2">
          <Select id="bed_id" name="bed_id" defaultValue={tenant?.bed_id ?? "none"}>
            <option value="none">Unassigned</option>
            {options.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={tenant?.phone ?? ""} placeholder="+9198…" required />
        </FieldRow>
        <FieldRow label="Aadhaar (last 4)" htmlFor="aadhaar_number">
          <Input id="aadhaar_number" name="aadhaar_number" defaultValue={tenant?.aadhaar_number ?? ""} placeholder="XXXX-XXXX-1234" />
        </FieldRow>
        <FieldRow label="Security deposit (₹)" htmlFor="security_deposit">
          <Input id="security_deposit" name="security_deposit" type="number" min={0} defaultValue={tenant?.security_deposit ?? ""} placeholder="24000" required />
        </FieldRow>
        <FieldRow label="Rent due day" htmlFor="rent_due_day">
          <Input id="rent_due_day" name="rent_due_day" type="number" min={1} max={28} defaultValue={tenant?.rent_due_day ?? 5} />
        </FieldRow>
        {!tenant && (
          <>
            <FieldRow label="Check-in date" htmlFor="checkin_date">
              <Input id="checkin_date" name="checkin_date" type="date" required />
            </FieldRow>
            <FieldRow
              label="Joining fee (₹)"
              htmlFor="joining_fee"
              hint="one-time, optional"
            >
              <Input
                id="joining_fee"
                name="joining_fee"
                type="number"
                min={0}
                placeholder="0"
              />
            </FieldRow>
          </>
        )}
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

      {!tenant ? (
        <div className="rounded-xl border border-line bg-paper-2/50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Tenant login
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Login email" htmlFor="email">
              <Input id="email" name="email" type="email" placeholder="arjun@tenant.in" required />
            </FieldRow>
            <FieldRow label="Password" htmlFor="login_password">
              <Input id="login_password" name="login_password" type="text" placeholder="min 6 chars" required />
            </FieldRow>
          </div>
        </div>
      ) : (
        <FieldRow label="Login email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={tenant.email} required />
        </FieldRow>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending || busy !== null}>
          {pending ? (
            <><Loader2 className="size-4 animate-spin" /> Saving…</>
          ) : tenant ? (
            "Save changes"
          ) : (
            "Add tenant"
          )}
        </Button>
      </div>
    </form>
  );
}
