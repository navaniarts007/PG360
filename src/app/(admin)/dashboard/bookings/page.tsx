import type { Metadata } from "next";
import { CalendarCheck, Link2, Phone } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingStatusControl } from "@/components/admin/booking-status-control";
import { BookingEditDialog } from "@/components/admin/booking-edit-dialog";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { deleteBookingAction } from "@/lib/actions/booking";
import { requireRole } from "@/lib/guards";
import { listBookings } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Bookings" };

const STATUS_TONE = { pending: "gold", approved: "teal", rejected: "rose" } as const;
const ROOM = { single: "Single", double: "Double", triple: "Triple", any: "Any room" } as const;

export default async function BookingsPage() {
  const user = await requireRole(["admin", "staff"]);
  const bookings = await listBookings();
  const pending = bookings.filter((b) => b.status === "pending").length;
  const bookingLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/book/${user.pg_id}`;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Inbox"
        title="Room requests"
        subtitle={`${pending} pending · ${bookings.length} total`}
      />

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
            <Link2 className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Your public booking link</p>
            <p className="text-xs text-ink-muted">Share it anywhere — requests land here.</p>
          </div>
        </div>
        <code className="truncate rounded-lg border border-line bg-paper-2/60 px-3 py-2 font-mono text-xs text-ink-soft">
          {bookingLink}
        </code>
      </Card>

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No requests yet"
          body="When someone submits your booking link, it shows up here to approve or reject."
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Card key={b.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid size-11 place-items-center rounded-xl bg-paper-2 text-ink-soft ring-1 ring-line">
                  <CalendarCheck className="size-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{b.tenant_name}</p>
                    <Badge tone={STATUS_TONE[b.status]} dot className="capitalize">
                      {b.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" /> {b.phone}
                    </span>
                    <span>{ROOM[b.preferred_room_type]}</span>
                    {b.requested_date && <span>from {formatDate(b.requested_date)}</span>}
                    <span>· requested {formatDate(b.created_at)}</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <BookingStatusControl id={b.id} status={b.status} />
                <BookingEditDialog booking={b} />
                <ConfirmDelete action={deleteBookingAction} id={b.id} title="Delete request" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
