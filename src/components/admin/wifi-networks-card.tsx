"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Loader2, Pencil, Plus, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input } from "@/components/ui/field";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import {
  createWifiAction,
  deleteWifiAction,
  updateWifiAction,
  type ActionState,
} from "@/lib/actions/wifi";
import type { WifiNetwork } from "@/lib/types";

export function WifiNetworksCard({ networks }: { networks: WifiNetwork[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line p-5 sm:p-6">
        <div>
          <h3 className="flex items-center gap-2 text-lg text-ink">
            <Wifi className="size-4 text-ink-muted" /> WiFi networks
          </h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            Add your WiFi once — pick it from a dropdown when creating a room.
          </p>
        </div>
        <WifiDialog />
      </div>

      {networks.length === 0 ? (
        <p className="p-6 text-sm text-ink-muted">
          No networks yet. Add one to use it on your rooms.
        </p>
      ) : (
        <div className="divide-y divide-line">
          {networks.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
              <div>
                <p className="font-semibold text-ink">{n.ssid}</p>
                <p className="font-mono text-xs text-ink-muted">{n.password}</p>
              </div>
              <div className="flex items-center gap-1">
                <WifiDialog network={n} />
                <ConfirmDelete action={deleteWifiAction} id={n.id} title="Delete network" />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function WifiDialog({ network }: { network?: WifiNetwork }) {
  const editing = !!network;
  return (
    <Modal
      title={editing ? "Edit WiFi network" : "Add a WiFi network"}
      description={
        editing
          ? "Changes apply to every room using this network."
          : "Give it a name (SSID) and password."
      }
      trigger={(open) =>
        editing ? (
          <button
            onClick={open}
            title="Edit network"
            className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-paper-2 hover:text-clay-600"
          >
            <Pencil className="size-4" />
          </button>
        ) : (
          <Button onClick={open} size="sm">
            <Plus className="size-4" /> Add network
          </Button>
        )
      }
    >
      {(close) => <WifiForm network={network} onDone={close} />}
    </Modal>
  );
}

function WifiForm({ network, onDone }: { network?: WifiNetwork; onDone: () => void }) {
  const editing = !!network;
  const [state, action, pending] = useActionState<ActionState, FormData>(
    editing ? updateWifiAction : createWifiAction,
    {},
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      {editing && <input type="hidden" name="id" value={network!.id} />}
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <FieldRow label="Network name (SSID)" htmlFor="ssid">
        <Input id="ssid" name="ssid" defaultValue={network?.ssid ?? ""} placeholder="Sunrise-2F" required />
      </FieldRow>
      <FieldRow label="Password" htmlFor="password">
        <Input id="password" name="password" defaultValue={network?.password ?? ""} placeholder="Sunrise@201" required />
      </FieldRow>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : editing ? "Save changes" : "Add network"}
        </Button>
      </div>
    </form>
  );
}
