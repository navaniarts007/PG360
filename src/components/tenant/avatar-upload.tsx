"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { uploadToStorage } from "@/lib/upload-client";
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
      const url = await uploadToStorage(file, "pg360/avatars");
      setCurrent(url);
      start(() => {
        const body = new FormData();
        body.set("avatar_url", url);
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
