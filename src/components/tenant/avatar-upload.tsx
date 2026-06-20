"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { getUploadSignatureAction } from "@/lib/actions/upload";
import { tenantUpdateAvatarAction } from "@/lib/actions/tenant";
import { initials } from "@/lib/utils";

/** Tenant profile photo with inline upload (camera overlay). Falls back to the
 *  initials badge when no photo is set. */
export function AvatarUpload({
  name,
  url,
}: {
  name: string;
  url: string | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(url);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (file: File) => {
    setBusy(true);
    try {
      const sig = await getUploadSignatureAction("pg360/avatars");
      if (!sig.ok) throw new Error(sig.error);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.apiKey);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: "POST", body: fd },
      );
      const json = (await res.json()) as { secure_url?: string };
      if (!json.secure_url) throw new Error("Upload failed");
      setCurrent(json.secure_url);
      start(() => {
        const body = new FormData();
        body.set("avatar_url", json.secure_url!);
        void tenantUpdateAvatarAction(body).then(() => router.refresh());
      });
    } catch {
      /* swallow — keep the previous avatar */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy || pending}
        className="group relative grid size-16 place-items-center overflow-hidden rounded-2xl bg-ink text-xl font-semibold text-paper shadow-lift"
        title="Change photo"
      >
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt={name} className="size-full object-cover" />
        ) : (
          initials(name)
        )}
        <span className="absolute inset-0 grid place-items-center bg-ink/50 opacity-0 transition-opacity group-hover:opacity-100">
          {busy || pending ? (
            <Loader2 className="size-5 animate-spin text-white" />
          ) : (
            <Camera className="size-5 text-white" />
          )}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
        }}
      />
    </div>
  );
}
