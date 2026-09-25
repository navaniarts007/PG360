"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ImageUp,
  Loader2,
  Pencil,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { SignaturePad } from "@/components/signature-pad";
import {
  addTenantAction,
  updateTenantAction,
  type ActionState,
} from "@/lib/actions/admin";
import { signAgreementForTenantAction, type ActionState as AgreementActionState } from "@/lib/actions/agreement";
import { uploadKyc, uploadToStorage } from "@/lib/upload-client";
import { inr } from "@/lib/utils";
import type { BedOption } from "@/lib/db";
import type { AgreementSection, Tenant } from "@/lib/types";

export function AddTenantDialog({
  beds,
  tenant,
  agreementSections,
  ownerSignatureUrl,
  existingAgreement,
}: {
  beds: BedOption[];
  tenant?: Tenant;
  agreementSections?: AgreementSection[];
  ownerSignatureUrl?: string | null;
  /** Editing only — the tenant's already-signed agreement, if any. */
  existingAgreement?: { signatureUrl: string; acceptedAt: string } | null;
}) {
  const isEdit = !!tenant;
  return (
    <Modal
      title={isEdit ? `Edit ${tenant.name}` : "Add a tenant"}
      description={
        isEdit
          ? "Rent follows the assigned bed."
          : "Pick a bed — rent auto-fills. Login email/password are optional."
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
      {(close) => (
        <TenantOnboarding
          beds={beds}
          tenant={tenant}
          agreementSections={agreementSections ?? []}
          ownerSignatureUrl={ownerSignatureUrl ?? null}
          existingAgreement={existingAgreement ?? null}
          onDone={close}
        />
      )}
    </Modal>
  );
}

/** Create flow: step 1 (mandatory) is the registration form; step 2
 *  (optional) — read & sign the resident agreement — shows right after the
 *  new tenant is created, only when agreement sections exist.
 *  Edit flow: the form plus a standing "resident agreement signature"
 *  section at the end, so a signature skipped at signup (or one that needs
 *  replacing) can be added any time. */
function TenantOnboarding({
  beds,
  tenant,
  agreementSections,
  ownerSignatureUrl,
  existingAgreement,
  onDone,
}: {
  beds: BedOption[];
  tenant?: Tenant;
  agreementSections: AgreementSection[];
  ownerSignatureUrl: string | null;
  existingAgreement: { signatureUrl: string; acceptedAt: string } | null;
  onDone: () => void;
}) {
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  if (!tenant) {
    if (created) {
      return (
        <AgreementStep
          tenantId={created.id}
          tenantName={created.name}
          sections={agreementSections}
          ownerSignatureUrl={ownerSignatureUrl}
          onDone={onDone}
        />
      );
    }
    return (
      <TenantForm
        beds={beds}
        onDone={onDone}
        onCreated={agreementSections.length > 0 ? (id, name) => setCreated({ id, name }) : undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      <TenantForm beds={beds} tenant={tenant} onDone={onDone} />
      {agreementSections.length > 0 && (
        <div className="border-t border-line pt-5">
          <AgreementStep
            tenantId={tenant.id}
            tenantName={tenant.name}
            sections={agreementSections}
            ownerSignatureUrl={ownerSignatureUrl}
            existingSignatureUrl={existingAgreement?.signatureUrl ?? null}
            existingSignedAt={existingAgreement?.acceptedAt ?? null}
            standalone
          />
        </div>
      )}
    </div>
  );
}

function TenantForm({
  beds,
  tenant,
  onDone,
  onCreated,
}: {
  beds: BedOption[];
  tenant?: Tenant;
  onDone: () => void;
  /** When set, a successful create hands off to step 2 instead of closing. */
  onCreated?: (tenantId: string, tenantName: string) => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    tenant ? updateTenantAction : addTenantAction,
    {},
  );
  const [name, setName] = useState(tenant?.name ?? "");
  const [selfie, setSelfie] = useState<string | null>(tenant?.avatar_url ?? null); // check-in photo
  const initialPhotos = tenant?.aadhaar_photo_url
    ? tenant.aadhaar_photo_url.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const [idPhotos, setIdPhotos] = useState<string[]>(initialPhotos); // ID doc keys/urls (up to 4)
  const [idPreviews, setIdPreviews] = useState<string[]>([]); // local previews for fresh picked files
  const [occupation, setOccupation] = useState(tenant?.occupation ?? "");
  const [stayType, setStayType] = useState<"monthly" | "daily">(tenant?.stay_type ?? "monthly");
  const [dRate, setDRate] = useState(tenant?.daily_rate ?? 0);
  const [dDays, setDDays] = useState(tenant?.stay_days ?? 0);
  const [bedId, setBedId] = useState(tenant?.bed_id ?? "none");
  // monthly rent — auto-fills from the bed but stays editable (per-tenant discounts)
  const [rent, setRent] = useState(
    tenant?.rent_amount ?? beds.find((b) => b.id === tenant?.bed_id)?.price ?? 0,
  );
  const [busy, setBusy] = useState<null | "selfie" | "id">(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const idCameraRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    if (onCreated && state.tenantId) {
      onCreated(state.tenantId, name);
    } else {
      onDone();
    }
  }, [state.ok, state.tenantId, onDone, onCreated, name, router]);

  const options = beds.filter((b) => b.status === "vacant" || b.id === tenant?.bed_id);

  const upload = async (file: File, which: "selfie" | "id") => {
    setBusy(which);
    setUploadErr(null);
    try {
      // ID/Aadhaar → private, staff-only folder on the VPS.
      if (which === "id") {
        if (idPhotos.length >= 4) {
          throw new Error("Maximum 4 ID photos allowed.");
        }
        const blobUrl = URL.createObjectURL(file);
        const key = await uploadKyc(file);
        setIdPreviews((prev) => [...prev, blobUrl]);
        setIdPhotos((prev) => [...prev, key]);
        return;
      }
      // Check-in selfie (not PII).
      const url = await uploadToStorage(file, "pg360/avatars");
      setSelfie(url);
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
      <input type="hidden" name="aadhaar_photo_url" value={idPhotos.join(",")} />
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
          <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Arjun Nair" required />
        </FieldRow>
        <FieldRow label="Bed" htmlFor="bed_id" hint="rent auto-fills" className="col-span-2">
          <Select
            id="bed_id"
            name="bed_id"
            value={bedId}
            onChange={(e) => {
              const id = e.target.value;
              setBedId(id);
              const b = beds.find((x) => x.id === id);
              if (b) setRent(b.price); // auto-fill, still editable below
            }}
          >
            <option value="none">Unassigned</option>
            {options.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </Select>
        </FieldRow>
        {stayType === "monthly" && (
          <FieldRow label="Monthly rent (₹)" htmlFor="rent_amount" hint="editable — e.g. a discount" className="col-span-2">
            <Input
              id="rent_amount"
              name="rent_amount"
              type="number"
              min={0}
              value={rent || ""}
              onChange={(e) => setRent(+e.target.value)}
              placeholder="7000"
            />
          </FieldRow>
        )}
        <FieldRow label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={tenant?.phone ?? ""} placeholder="+9198…" required />
        </FieldRow>
        <FieldRow label="Parent's phone" htmlFor="parent_phone" hint="optional">
          <Input id="parent_phone" name="parent_phone" defaultValue={tenant?.parent_phone ?? ""} placeholder="optional" />
        </FieldRow>
        <FieldRow label="Other (guardian / friend)" htmlFor="guardian" hint="optional — name & number" className="col-span-2">
          <Input id="guardian" name="guardian" defaultValue={tenant?.guardian ?? ""} placeholder="e.g. Ravi (friend) +9198…" />
        </FieldRow>
        <FieldRow label="Vehicle number" htmlFor="vehicle_number" hint="optional">
          <Input id="vehicle_number" name="vehicle_number" defaultValue={tenant?.vehicle_number ?? ""} placeholder="e.g. TN 01 AB 1234" />
        </FieldRow>
        <FieldRow label="Address" htmlFor="address" hint="optional" className="col-span-2">
          <Input id="address" name="address" defaultValue={tenant?.address ?? ""} placeholder="Home / permanent address (optional)" />
        </FieldRow>
        <FieldRow label="Occupation" htmlFor="occupation" hint="optional">
          <Select id="occupation" name="occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)}>
            <option value="">—</option>
            <option value="student">Student</option>
            <option value="working">Working professional</option>
            <option value="other">Other</option>
          </Select>
        </FieldRow>
        {(occupation === "student" || occupation === "working") && (
          <FieldRow
            label={occupation === "student" ? "Institute name" : "Company name"}
            htmlFor="organization"
            hint="optional"
          >
            <Input
              id="organization"
              name="organization"
              defaultValue={tenant?.organization ?? ""}
              placeholder={occupation === "student" ? "School / college" : "Company"}
            />
          </FieldRow>
        )}
        <FieldRow label="Aadhaar (last 4)" htmlFor="aadhaar_number">
          <Input id="aadhaar_number" name="aadhaar_number" defaultValue={tenant?.aadhaar_number ?? ""} placeholder="XXXX-XXXX-1234" />
        </FieldRow>
        <FieldRow label="Security deposit (₹)" htmlFor="security_deposit">
          <Input id="security_deposit" name="security_deposit" type="number" min={0} defaultValue={tenant?.security_deposit ?? ""} placeholder="24000" required />
        </FieldRow>
        <FieldRow label="Rent due day" htmlFor="rent_due_day">
          <Input id="rent_due_day" name="rent_due_day" type="number" min={1} max={28} defaultValue={tenant?.rent_due_day ?? 5} />
        </FieldRow>
        <FieldRow label="Stay type" htmlFor="stay_type" className="col-span-2">
          <Select
            id="stay_type"
            name="stay_type"
            value={stayType}
            onChange={(e) => setStayType(e.target.value as "monthly" | "daily")}
          >
            <option value="monthly">Monthly (rent per month)</option>
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
        <FieldRow label="Check-in date" htmlFor="checkin_date">
          <Input
            id="checkin_date"
            name="checkin_date"
            type="date"
            defaultValue={tenant?.checkin_date?.slice(0, 10) ?? ""}
            required
          />
        </FieldRow>
        <FieldRow
          label="Joining fee (₹)"
          htmlFor="joining_fee"
          hint={tenant ? "adds a new one-time fee" : "one-time, optional"}
        >
          <Input
            id="joining_fee"
            name="joining_fee"
            type="number"
            min={0}
            placeholder="0"
          />
        </FieldRow>
      </div>

      {/* Aadhaar / ID photo — up to 4 photos */}
      <div className="rounded-xl border border-line bg-paper-2/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            ID photos (Aadhaar / proof)
          </p>
          <span className="text-xs text-ink-muted font-medium">
            {idPhotos.length}/4 added
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          {idPhotos.map((p, idx) => {
            const preview = idPreviews[idx] || (/^https?:/.test(p) ? p : null);
            return (
              <div key={idx} className="relative group size-16 rounded-lg border border-line overflow-hidden bg-paper shadow-sm">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt={`ID ${idx + 1}`} className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-[0.6rem] font-semibold text-teal-600 bg-teal-50">
                    Photo #{idx + 1}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIdPhotos((prev) => prev.filter((_, i) => i !== idx));
                    setIdPreviews((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  className="absolute top-1 right-1 rounded-full bg-rose-600 p-0.5 text-white shadow hover:bg-rose-700 transition-colors"
                  title="Remove photo"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}

          {idPhotos.length < 4 && (
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f, "id");
                  e.target.value = "";
                }}
              />
              <input
                ref={idCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f, "id");
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => idCameraRef.current?.click()}
                disabled={busy === "id"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-clay-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-clay-700 disabled:opacity-60"
              >
                {busy === "id" ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                Take photo
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy === "id"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-soft transition-colors hover:text-clay-600 disabled:opacity-60"
              >
                <ImageUp className="size-3.5" />
                Upload
              </button>
            </div>
          )}
        </div>
        {uploadErr && <p className="mt-1.5 text-xs text-rose-600">{uploadErr}</p>}
      </div>

      {!tenant ? (
        <div className="rounded-xl border border-line bg-paper-2/50 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Tenant login <span className="font-normal normal-case text-ink-muted">— optional</span>
          </p>
          <p className="mb-3 text-xs text-ink-muted">
            Add both to give the resident a portal login. Leave blank to just keep a record.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Login email" htmlFor="email">
              <Input id="email" name="email" type="email" placeholder="optional" />
            </FieldRow>
            <FieldRow label="Password" htmlFor="login_password">
              <Input id="login_password" name="login_password" type="text" placeholder="optional, 8+ chars" />
            </FieldRow>
          </div>
        </div>
      ) : (
        <FieldRow label="Login email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={tenant.email} />
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

/* ── Read & sign the resident agreement. Two contexts:
   - Onboarding (right after "Add tenant"): "Step 2 of 2 · optional", can be
     skipped, and a successful save closes the whole dialog.
   - Standalone (inside "Edit tenant", always available): shows the current
     signed status, lets it be added or replaced any time, and saving just
     refreshes in place — it doesn't close the edit dialog. ───────────────── */

function AgreementStep({
  tenantId,
  tenantName,
  sections,
  ownerSignatureUrl,
  existingSignatureUrl = null,
  existingSignedAt = null,
  standalone = false,
  onDone,
}: {
  tenantId: string;
  tenantName: string;
  sections: AgreementSection[];
  ownerSignatureUrl: string | null;
  existingSignatureUrl?: string | null;
  existingSignedAt?: string | null;
  standalone?: boolean;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState<AgreementActionState, FormData>(
    signAgreementForTenantAction,
    {},
  );
  const [value, setValue] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    if (!standalone) onDone?.();
  }, [state.ok, standalone, onDone, router]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          {standalone ? (
            <h3 className="font-display text-lg font-semibold text-ink">Resident agreement</h3>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-clay-500">Step 2 of 2 · optional</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-ink">
                Read &amp; sign the resident agreement
              </h3>
            </>
          )}
          <p className="mt-1 text-sm text-ink-muted">
            {standalone
              ? "Add or replace the tenant's signature any time."
              : `${tenantName || "The tenant"} has been added. Walk through the house rules together now, or skip — they'll be asked to read & sign this the first time they log in themselves.`}
          </p>
        </div>
        {standalone && (
          <span
            className={
              existingSignatureUrl
                ? "shrink-0 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-100"
                : "shrink-0 rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-semibold text-gold-700 ring-1 ring-gold-100"
            }
          >
            {existingSignatureUrl
              ? `Signed${existingSignedAt ? ` ${new Date(existingSignedAt).toLocaleDateString("en-IN")}` : ""}`
              : "Not signed yet"}
          </span>
        )}
      </div>

      <div className="max-h-56 space-y-4 overflow-y-auto rounded-xl border border-line bg-paper-2/40 p-4">
        {sections.map((s, i) => (
          <div key={s.id}>
            <p className="text-sm font-semibold text-ink">
              {i + 1}. {s.title}
            </p>
            {s.body && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">{s.body}</p>}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-paper-2/40 p-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Owner signature
        </p>
        {ownerSignatureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ownerSignatureUrl} alt="Owner signature" className="max-h-14 object-contain" />
        ) : (
          <p className="text-xs text-ink-muted">Not signed yet — add it in Settings.</p>
        )}
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input type="hidden" name="signature_url" value={value ?? ""} />
        {state.error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
            <AlertCircle className="size-3.5 shrink-0" /> {state.error}
          </div>
        )}
        {state.ok && standalone && !value && (
          <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-700">
            <CheckCircle2 className="size-3.5 shrink-0" /> Signature saved.
          </div>
        )}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Tenant signature
          </p>
          {existingSignatureUrl && !value && (
            <div className="mb-2 rounded-xl border border-line bg-paper-2/40 p-3">
              <p className="mb-1 text-xs font-semibold text-teal-600">✓ Current signature</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={existingSignatureUrl} alt="Tenant signature" className="max-h-16 object-contain" />
              <p className="mt-1 text-xs text-ink-muted">Draw or upload below to replace it.</p>
            </div>
          )}
          <SignaturePad onChange={setValue} />
        </div>
        <div className="flex gap-2 pt-1">
          {!standalone && (
            <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
              Skip for now
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={pending || !value}>
            {pending ? (
              <><Loader2 className="size-4 animate-spin" /> Saving…</>
            ) : standalone ? (
              <><CheckCircle2 className="size-4" /> Save signature</>
            ) : (
              <><CheckCircle2 className="size-4" /> Save &amp; finish</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
