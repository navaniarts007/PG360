/* =========================================================================
   Turn raw Supabase / Postgres errors into messages an end user understands.
   We never surface SQL / constraint jargon (e.g. 'violates check constraint
   "rooms_type_check"') to the UI — those go to the server logs, users get a
   plain-English line.
   ========================================================================= */

interface DbError {
  message?: string;
  code?: string;
  details?: string;
}

export function humanizeDbError(
  err: DbError | null | undefined,
  fallback = "Something went wrong. Please try again.",
): string {
  const msg = err?.message ?? "";
  const code = err?.code ?? "";

  if (code === "23505" || /duplicate key|already exists|unique constraint/i.test(msg))
    return "This already exists — please use a different value.";

  if (code === "23514" || /violates check constraint/i.test(msg))
    return "Some details aren't valid here. Please review the form and try again.";

  if (code === "23503" || /foreign key/i.test(msg))
    return "This is linked to other records, so it can't be saved as-is.";

  if (code === "23502" || /null value in column|not-null/i.test(msg))
    return "Please fill in all the required fields.";

  if (code === "42501" || /row-level security|permission denied|not authoriz/i.test(msg))
    return "You don't have permission to do that.";

  if (/out of range|invalid input syntax|invalid.*date/i.test(msg))
    return "One of the values looks invalid. Please check it and try again.";

  // Log the real error server-side for debugging; never show it to the user.
  if (msg) console.error("[db]", code, msg);
  return fallback;
}
