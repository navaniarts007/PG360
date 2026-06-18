"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Select, Textarea } from "@/components/ui/field";
import { updateIssueAction, type ActionState } from "@/lib/actions/admin";
import type { IssueCategory } from "@/lib/types";

const CATEGORIES: { value: IssueCategory; label: string }[] = [
  { value: "electricity", label: "Electricity" },
  { value: "plumbing", label: "Plumbing" },
  { value: "wifi", label: "WiFi" },
  { value: "cleaning", label: "Cleaning" },
  { value: "noise", label: "Noise" },
  { value: "other", label: "Other" },
];

export function IssueEditDialog({
  id,
  category,
  description,
}: {
  id: string;
  category: IssueCategory;
  description: string;
}) {
  return (
    <Modal
      title="Edit complaint"
      description="Correct the category or details of this complaint."
      trigger={(open) => (
        <button
          onClick={open}
          title="Edit complaint"
          className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-paper-2 hover:text-clay-600"
        >
          <Pencil className="size-4" />
        </button>
      )}
    >
      {(close) => (
        <IssueForm id={id} category={category} description={description} onDone={close} />
      )}
    </Modal>
  );
}

function IssueForm({
  id,
  category,
  description,
  onDone,
}: {
  id: string;
  category: IssueCategory;
  description: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateIssueAction,
    {},
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <FieldRow label="Category" htmlFor="category">
        <Select id="category" name="category" defaultValue={category}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </FieldRow>
      <FieldRow label="Description" htmlFor="description">
        <Textarea id="description" name="description" defaultValue={description} required />
      </FieldRow>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}
