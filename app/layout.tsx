import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wealth Portfolio Tracker | Prototype",
  description:
    "An early Wealth Portfolio Tracker prototype for the Talent Syria technical assessment. Portfolio data and account features are not connected yet.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
