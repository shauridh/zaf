import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "ChickenPOS",
    template: "%s · ChickenPOS",
  },
  description:
    "POS modern untuk gerai fried chicken — kasir layar sentuh, operasional real-time, pembayaran lancar.",
  applicationName: "ChickenPOS",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom tidak dikunci di sini (aksesibilitas); pembatasan pinch-zoom
  // dilakukan via mode kios/perangkat POS, bukan meta viewport.
  themeColor: "#0c0a09",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
