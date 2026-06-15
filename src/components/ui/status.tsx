import { Badge } from "./badge";
import type {
  IssueStatus,
  PaymentStatus,
  PgStatus,
  RoomStatus,
  TenantStatus,
} from "@/lib/types";

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  const map = {
    paid: { tone: "teal", label: "Paid" },
    partial: { tone: "gold", label: "Partial" },
    due: { tone: "rose", label: "Due" },
  } as const;
  const s = map[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function RoomStatusPill({ status }: { status: RoomStatus }) {
  const map = {
    vacant: { tone: "neutral", label: "Vacant" },
    partial: { tone: "gold", label: "Partial" },
    occupied: { tone: "teal", label: "Occupied" },
  } as const;
  const s = map[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function IssueStatusPill({ status }: { status: IssueStatus }) {
  const map = {
    open: { tone: "open", label: "Open" },
    in_progress: { tone: "progress", label: "In progress" },
    resolved: { tone: "resolved", label: "Resolved" },
  } as const;
  const s = map[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function TenantStatusPill({ status }: { status: TenantStatus }) {
  return status === "active" ? (
    <Badge tone="teal" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="neutral">Checked out</Badge>
  );
}

export function PgStatusPill({ status }: { status: PgStatus }) {
  return status === "active" ? (
    <Badge tone="teal" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="rose" dot>
      Suspended
    </Badge>
  );
}
