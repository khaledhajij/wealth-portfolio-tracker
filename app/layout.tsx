import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wealth Portfolio Tracker | Prototype",
  description:
    "A Wealth Portfolio Tracker assessment prototype with recorded holdings, timestamped manual USD prices and portfolio permissions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body>
    </html>
  );
}
