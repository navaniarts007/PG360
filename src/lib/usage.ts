import "server-only";
import { createClient } from "./supabase/server";

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

/** Live Supabase snapshot via the secured platform_usage() function. */
export async function supabaseUsage(): Promise<SupabaseUsage | null> {
  try {
    const s = await createClient();
    const { data, error } = await s.rpc("platform_usage");
    if (error || !data || Object.keys(data).length === 0) return null;
    return data as SupabaseUsage;
  } catch {
    return null;
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
