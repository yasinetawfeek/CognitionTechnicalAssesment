import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Internal Tools", template: "%s · Internal Tools" },
  description: "Internal tools kernel",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
