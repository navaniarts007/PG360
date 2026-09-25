import "server-only";

export interface SupabaseUsage {
  db_bytes: number;
  auth_users: number;
  storage_objects: number;
  storage_bytes: number;
  pg_count: number;
  tenant_count: number;
  payment_count: number;
  activity_count: number;
}

/** This branch runs on MySQL, not Supabase — there's no project for this
 *  deployment to report quota/usage for. Always null; the caller already
 *  degrades gracefully (deep-links to a dashboard instead) when this is null. */
export async function supabaseUsage(): Promise<SupabaseUsage | null> {
  return null;
}

export interface SupabaseEgress {
  configured: boolean; // a management token is present
  egressBytes: number | null; // null = couldn't read it automatically
  quotaGb: number; // plan egress allowance for context
}

/** Bandwidth / egress via the Supabase Management API (opt-in: needs
 *  SUPABASE_ACCESS_TOKEN). Best-effort — egress isn't on every plan's API, so
 *  we degrade gracefully and the UI deep-links to the dashboard. */
export async function supabaseEgress(): Promise<SupabaseEgress> {
  const quotaGb = process.env.SUPABASE_PLAN === "pro" ? 250 : 5;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref =
    process.env.SUPABASE_PROJECT_REF ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];
  if (!token || !ref) return { configured: false, egressBytes: null, quotaGb };
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/usage`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return { configured: true, egressBytes: null, quotaGb };
    const j = (await res.json()) as Record<string, unknown> & {
      total_egress_bytes?: number;
      db_egress?: number;
      egress?: { usage?: number };
    };
    const egress =
      (typeof j.total_egress_bytes === "number" && j.total_egress_bytes) ||
      (typeof j.db_egress === "number" && j.db_egress) ||
      (typeof j.egress?.usage === "number" && j.egress.usage) ||
      null;
    return { configured: true, egressBytes: egress, quotaGb };
  } catch {
    return { configured: true, egressBytes: null, quotaGb };
  }
}

export interface CloudinaryUsage {
  plan: string;
  storageBytes: number;
  bandwidthBytes: number;
  transformations: number;
  creditsUsed: number | null;
  creditsLimit: number | null;
  objects: number;
}

/** Live Cloudinary usage via the Admin API (uses our key/secret). */
export async function cloudinaryUsage(): Promise<CloudinaryUsage | null> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) return null;
  try {
    const auth = Buffer.from(`${key}:${secret}`).toString("base64");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/usage`, {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      plan?: string;
      storage?: { usage?: number };
      bandwidth?: { usage?: number };
      transformations?: { usage?: number };
      objects?: { usage?: number };
      credits?: { usage?: number; limit?: number };
    };
    return {
      plan: j.plan ?? "—",
      storageBytes: j.storage?.usage ?? 0,
      bandwidthBytes: j.bandwidth?.usage ?? 0,
      transformations: j.transformations?.usage ?? 0,
      objects: j.objects?.usage ?? 0,
      creditsUsed: j.credits?.usage ?? null,
      creditsLimit: j.credits?.limit ?? null,
    };
  } catch {
    return null;
  }
}

export interface VercelDeploy {
  state: string;
  url: string;
  created: number;
}
export interface VercelInfo {
  configured: boolean;
  deployments: VercelDeploy[];
}

/** Recent Vercel deployments — only if a VERCEL_TOKEN is configured. */
export async function vercelInfo(): Promise<VercelInfo> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return { configured: false, deployments: [] };
  try {
    const team = process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : "";
    const proj = process.env.VERCEL_PROJECT_ID ? `&projectId=${process.env.VERCEL_PROJECT_ID}` : "";
    const res = await fetch(`https://api.vercel.com/v6/deployments?limit=6${proj}${team}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return { configured: true, deployments: [] };
    const j = (await res.json()) as { deployments?: { state?: string; readyState?: string; url: string; created: number }[] };
    return {
      configured: true,
      deployments: (j.deployments ?? []).map((d) => ({
        state: d.state ?? d.readyState ?? "—",
        url: d.url,
        created: d.created,
      })),
    };
  } catch {
    return { configured: true, deployments: [] };
  }
}
