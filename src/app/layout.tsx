import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Realty Check",
  description: "Real estate investment analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
