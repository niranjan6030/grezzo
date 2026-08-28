import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import ZipperIntro from "@/components/ZipperIntro";

/** The storefront shell. The admin console deliberately sits outside it. */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ZipperIntro />
      <Header />
      <main className="min-h-screen pt-[68px]">{children}</main>
      <Footer />
      <CookieConsent />
    </>
  );
}
