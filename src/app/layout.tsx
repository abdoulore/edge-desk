import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import WalletProviders from "@/wallet/Providers";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Edge Desk - DreamDEX Event Contracts",
  description:
    "Explainable rule-based trading desk for DreamDEX binary Event Contracts on Somnia Shannon.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0e13",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className="grain-overlay bg-desk-bg font-sans text-desk-ink antialiased">
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
