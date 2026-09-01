import { Jost } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { CatalogueProvider } from "@/components/CatalogueProvider";
import ServiceWorker from "@/components/ServiceWorker";
import { readAdminData } from "@/lib/admin/store";
import { mergeCatalogue } from "@/lib/catalogue";
import { SITE_URL } from "@/lib/site";

const jost = Jost({
  variable: "--font-grezzo-sans",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  display: "swap",
});

export const metadata = {
  // Without this, Open Graph and Twitter images resolve relative and break
  // every time the site is linked anywhere.
  metadataBase: new URL(SITE_URL),
  title: { default: "GREZZO — Jeans, only jeans", template: "%s · GREZZO" },
  description:
    "Menswear denim, and nothing else. Selvedge, stonewash and raw indigo, with the story of how each pair was made.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "GREZZO" },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "GREZZO — Jeans, only jeans",
    description: "Menswear denim: selvedge, stonewash and raw indigo.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export const viewport = {
  themeColor: "#16233a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }) {
  // Prices and offers are live, so the shell renders per request rather than
  // being baked at build time.
  const catalogue = mergeCatalogue(await readAdminData());

  return (
    <html lang="en">
      <body className={`${jost.variable} antialiased`}>
        <AuthProvider>
          <CatalogueProvider initial={catalogue}>{children}</CatalogueProvider>
        </AuthProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
