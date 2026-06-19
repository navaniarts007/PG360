import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SmoothScroll } from "@/components/marketing/smooth-scroll";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <SmoothScroll />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
