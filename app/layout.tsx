import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spray-Net South Charlotte · Your project",
  description: "Your project photos and a simple way to share your experience.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
