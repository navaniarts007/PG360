import type { Role, StaffModule, StaffPermissions } from "./types";

/** Whatever carries a role + optional staff permissions (e.g. SessionUser). */
interface Principal {
  role: Role;
  permissions?: StaffPermissions | null;
}

/** Owners/super-admins always have everything. Staff with null permissions are
 *  treated as full access (legacy). Otherwise check the granted set. */
function unrestricted(p: Principal): boolean {
  return p.role !== "staff" || p.permissions == null;
}

export function canModule(p: Principal, mod: StaffModule): boolean {
  if (unrestricted(p)) return true;
  return p.permissions!.modules.includes(mod);
}

export function canEdit(p: Principal): boolean {
  if (unrestricted(p)) return true;
  return p.permissions!.edit;
}

export function canDelete(p: Principal): boolean {
  if (unrestricted(p)) return true;
  return p.permissions!.delete;
}
