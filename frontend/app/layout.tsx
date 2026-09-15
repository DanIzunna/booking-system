import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booking System | Reserve with confidence",
  description: "A focused booking platform for organizations and their customers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
