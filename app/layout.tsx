import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Roboto_Mono } from "next/font/google";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "海利物流管理系统 | HAI DEE LOGISTICS",
  description: "HAI DEE LOGISTICS CO., LTD — Powered by DMC SYSTEM",
  applicationName: "海利物流",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "海利物流",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A1628",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${ibmPlexSans.variable} ${robotoMono.variable}`}
    >
      <body className="min-h-screen bg-haidee-surface font-sans text-haidee-text antialiased">
        {children}
      </body>
    </html>
  );
}
