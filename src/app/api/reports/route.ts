import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/guards";
import {
  getMonthPayments,
  listExpenses,
  listRooms,
  pnl,
} from "@/lib/db";
import { currentMonth } from "@/lib/utils";

const csvCell = (v: string | number | null | undefined) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: (string | number | null | undefined)[][]) =>
  rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

export async function GET(req: NextRequest) {
  await requireRole(["admin", "staff"]);
  const type = req.nextUrl.searchParams.get("type") ?? "pnl";
  const month = req.nextUrl.searchParams.get("month") ?? currentMonth();

  let rows: (string | number | null | undefined)[][];
  switch (type) {
    case "rent": {
      const pays = await getMonthPayments(month);
      rows = [
        ["Tenant", "Room", "Billed", "Paid", "Balance", "Status", "Mode", "Date"],
        ...pays.map((p) => [
          p.name,
          p.room,
          p.total_amount,
          p.amount_paid,
          p.total_amount - p.amount_paid,
          p.status,
          p.payment_mode ?? "",
          p.payment_date ?? "",
        ]),
      ];
      break;
    }
    case "expenses": {
      const exps = await listExpenses(month);
      rows = [
        ["Date", "Category", "Note", "Amount"],
        ...exps.map((e) => [e.date, e.category, e.description ?? "", e.amount]),
      ];
      break;
    }
    case "occupancy": {
      const rooms = await listRooms();
      rows = [
        ["Room", "Floor", "Type", "Total beds", "Occupied", "Status"],
        ...rooms.map((r) => [
          r.room_number,
          r.floor,
          r.type,
          r.total_beds,
          r.occupied_beds,
          r.status,
        ]),
      ];
      break;
    }
    default: {
      const p = await pnl(month);
      rows = [
        ["Metric", "Amount"],
        ["Rent billed", p.billed],
        ["Rent collected", p.collected],
        ["Expenses", p.expenses],
        ["Net profit", p.net],
      ];
    }
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pg360-${type}-${month}.csv"`,
    },
  });
}
