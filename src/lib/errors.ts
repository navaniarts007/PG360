/* =========================================================================
   Turn raw MySQL errors into messages an end user understands. We never
   surface SQL / constraint jargon (e.g. "Duplicate entry '...' for key
   'uq_rooms_pg_number'") to the UI — those go to the server logs, users get
   a plain-English line.

   mysql2 error codes are strings (err.code, e.g. "ER_DUP_ENTRY"), not
   Postgres's numeric-string codes (e.g. "23505") — this is the MySQL
   equivalent of the original Postgres-code-based version.
   ========================================================================= */

interface DbError {
  message?: string;
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

export function humanizeDbError(
  err: DbError | null | undefined,
  fallback = "Something went wrong. Please try again.",
): string {
  const msg = err?.sqlMessage ?? err?.message ?? "";
  const code = err?.code ?? "";

  if (code === "ER_DUP_ENTRY" || /duplicate entry|already exists/i.test(msg))
    return "This already exists — please use a different value.";

  if (code === "ER_CHECK_CONSTRAINT_VIOLATED" || /check constraint/i.test(msg))
    return "Some details aren't valid here. Please review the form and try again.";

  if (
    code === "ER_NO_REFERENCED_ROW_2" ||
    code === "ER_ROW_IS_REFERENCED_2" ||
    code === "ER_NO_REFERENCED_ROW" ||
    code === "ER_ROW_IS_REFERENCED" ||
    /foreign key constraint/i.test(msg)
  )
    return "This is linked to other records, so it can't be saved as-is.";

  if (code === "ER_BAD_NULL_ERROR" || /cannot be null/i.test(msg))
    return "Please fill in all the required fields.";

  if (/out of range|incorrect.*value|truncated/i.test(msg))
    return "One of the values looks invalid. Please check it and try again.";

  // Log the real error server-side for debugging; never show it to the user.
  if (msg) console.error("[db]", code, msg);
  return fallback;
}
