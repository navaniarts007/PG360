"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input } from "@/components/ui/field";
import { resetOwnerPasswordAction, type ActionState } from "@/lib/actions/platform";

function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function ResetPasswordDialog({
  ownerId,
  ownerEmail,
}: {
  ownerId: string | null;
  ownerEmail: string | null;
}) {
  return (
    <Modal
      title="Reset login password"
      description={ownerEmail ? `For ${ownerEmail}` : "Set a new password for the owner login."}
      trigger={(open) => (
        <Button variant="outline" onClick={open}>
          <KeyRound className="size-4" /> Reset password
        </Button>
      )}
    >
      {() => <ResetForm ownerId={ownerId} />}
    </Modal>
  );
}

function ResetForm({ ownerId }: { ownerId: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    resetOwnerPasswordAction,
    {},
  );
  const [pw, setPw] = useState("");

  if (state.ok) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3 text-sm font-medium text-teal-700">
          <CheckCircle2 className="size-4 shrink-0" /> Password updated.
        </div>
        <div className="rounded-xl border border-line bg-paper-2/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">New password</p>
          <p className="mt-1 select-all font-mono text-lg font-semibold text-ink">{pw}</p>
          <p className="mt-1 text-xs text-ink-muted">Share this with the client securely. It won&apos;t be shown again.</p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="owner_id" value={ownerId ?? ""} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <FieldRow label="New password" htmlFor="new_password" hint="min 6 characters">
        <div className="flex gap-2">
          <Input
            id="new_password"
            name="new_password"
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Type or generate"
            required
          />
          <button
            type="button"
            onClick={() => setPw(randomPassword())}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink-soft hover:text-clay-600"
          >
            <RefreshCw className="size-3.5" /> Generate
          </button>
        </div>
      </FieldRow>

      <Button type="submit" className="w-full" disabled={pending || !ownerId}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Updating…
          </>
        ) : (
          "Update password"
        )}
      </Button>
    </form>
  );
}
