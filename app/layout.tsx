import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Fundreporting.com — Operating system for private investment vehicles",
    template: "%s · Fundreporting.com",
  },
  description:
    "FundReporting is the operating system for asset managers, family offices, and private funds. Run subscriptions, redemptions, distributions, NAV cycles, and investor reporting from one place — with a live cap table that always reflects the truth.",
  keywords: [
    "fund administration",
    "fund reporting",
    "private fund software",
    "family office software",
    "cap table",
    "NAV",
    "subscriptions",
    "redemptions",
    "distributions",
    "asset manager",
    "fund of funds",
    "investor reporting",
  ],
  applicationName: "FundReporting",
  authors: [{ name: "FundReporting" }],
  metadataBase: new URL("https://www.fundreporting.com"),
  openGraph: {
    type: "website",
    url: "https://www.fundreporting.com",
    siteName: "FundReporting",
    title: "FundReporting — Operating system for private investment vehicles",
    description:
      "Run subscriptions, redemptions, distributions, NAV cycles, and investor reporting from one place — with a live cap table that always reflects the truth.",
  },
  twitter: {
    card: "summary_large_image",
    title: "FundReporting — Operating system for private investment vehicles",
    description:
      "Run subscriptions, redemptions, distributions, NAV cycles, and investor reporting from one place.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
