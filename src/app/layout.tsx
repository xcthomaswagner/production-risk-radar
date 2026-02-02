import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Production Risk Radar",
  description: "AI-Enhanced Digital Twin Demo for Manufacturing Summit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
