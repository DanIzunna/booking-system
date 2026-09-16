import type { Metadata } from "next";
import { SessionProvider } from "../lib/auth/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bookable | Make anything bookable",
  description:
    "Create bookable resources, define availability, and share a booking page.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
