import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Edge Desk — DreamDEX Event Contracts",
  description:
    "Explainable rule-based trading desk for DreamDEX binary Event Contracts on Somnia Shannon.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0f14",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-desk-bg font-sans text-white antialiased">
        {children}
      </body>
    </html>
  );
}
