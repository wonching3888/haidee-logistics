import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "海利物流管理系统 | HAI DEE LOGISTICS",
  description: "HAI DEE LOGISTICS CO., LTD — Powered by DMC SYSTEM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} min-h-screen bg-haidee-surface font-sans text-haidee-text antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
