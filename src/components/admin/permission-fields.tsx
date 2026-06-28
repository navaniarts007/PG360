"use client";

import { STAFF_MODULES, STAFF_MODULE_LABELS, type StaffPermissions } from "@/lib/types";

/** Checkboxes for a staff member's privileges: which areas they can access, plus
 *  global edit / delete rights. Field names: mod_<module>, perm_edit, perm_delete. */
export function PermissionFields({ initial }: { initial?: StaffPermissions | null }) {
  // add mode (no initial): grant all areas + edit, but not delete, by default.
  const modOn = (m: string) => (initial ? initial.modules.includes(m as never) : true);
  const editOn = initial ? initial.edit : true;
  const delOn = initial ? initial.delete : false;

  return (
    <div className="rounded-xl border border-line bg-paper-2/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Privileges
      </p>
      <p className="mb-3 mt-0.5 text-xs text-ink-muted">Areas this staff can access.</p>

      <div className="grid grid-cols-2 gap-2">
        {STAFF_MODULES.map((m) => (
          <label key={m} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name={`mod_${m}`}
              defaultChecked={modOn(m)}
              className="size-4 rounded border-line text-clay-600 focus:ring-clay-500"
            />
            {STAFF_MODULE_LABELS[m]}
          </label>
        ))}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Actions</p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="perm_edit" defaultChecked={editOn} className="size-4 rounded border-line text-clay-600 focus:ring-clay-500" />
            Can edit records
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="perm_delete" defaultChecked={delOn} className="size-4 rounded border-line text-clay-600 focus:ring-clay-500" />
            Can delete records
          </label>
        </div>
      </div>
    </div>
  );
}
