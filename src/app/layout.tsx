import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PG 300 — PG & Hostel Management, done right",
    template: "%s · PG 300",
  },
  description:
    "PG 300 is the all-in-one operating system for PG and hostel owners in India — rooms, tenants, rent, food, complaints and P&L, with a login for every tenant.",
  keywords: [
    "PG management software",
    "hostel management",
    "rent collection",
    "India",
    "tenant portal",
  ],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: "#faf6ef",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- single global stylesheet for all routes */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,400..600&family=Hanken+Grotesk:wght@300..800&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
