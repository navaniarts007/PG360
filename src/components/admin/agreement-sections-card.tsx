"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileSignature, Loader2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldRow, Input } from "@/components/ui/field";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import {
  saveSectionAction,
  deleteSectionAction,
  type ActionState,
} from "@/lib/actions/agreement";
import type { AgreementSection } from "@/lib/types";

export function AgreementSectionsCard({
  sections,
}: {
  sections: AgreementSection[];
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <FileSignature className="size-4.5 text-clay-500" />
        <h3 className="text-lg text-ink">Resident agreement</h3>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Build your policy as numbered sections. New residents must read &amp; sign each
        one on first login.
      </p>

      {/* existing sections */}
      {sections.length > 0 && (
        <ol className="mt-4 space-y-2">
          {sections.map((s, i) => (
            <li key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-paper-2/40 p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {i + 1}. {s.title}
                </p>
                {s.body && <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{s.body}</p>}
              </div>
              <ConfirmDelete action={deleteSectionAction} id={s.id} title="Delete section" />
            </li>
          ))}
        </ol>
      )}

      <AddSection />
    </Card>
  );
}

function AddSection() {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSectionAction, {});
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="mt-4 space-y-3 rounded-xl border border-dashed border-line p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Add a section</p>
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          <AlertCircle className="size-3.5 shrink-0" /> {state.error}
        </div>
      )}
      <FieldRow label="Section title" htmlFor="title">
        <Input id="title" name="title" placeholder="e.g. House rules" required />
      </FieldRow>
      <FieldRow label="Details" htmlFor="body">
        <textarea
          id="body"
          name="body"
          rows={3}
          placeholder="What the resident is agreeing to…"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-clay-400"
        />
      </FieldRow>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Save section
      </Button>
    </form>
  );
}

