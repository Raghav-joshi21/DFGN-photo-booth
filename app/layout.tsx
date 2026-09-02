import type { Metadata, Viewport } from "next";
import { Baloo_2, Geist, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for the wordmark, hero and card titles — heavy and rounded.
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// Body copy: rounded sans that sits comfortably next to Baloo.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DFGN Photo Booth",
  description:
    "Live event photo wall for RTU Design Factory — part of the Design Factory Global Network.",
  applicationName: "DFGN Photo Booth",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // iOS add-to-home-screen: run standalone, custom home-screen title.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DFGN Booth",
  },
};

export const viewport: Viewport = {
  themeColor: "#7C3AED",
  // Full-bleed under the iOS status bar / notch when launched standalone.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${baloo.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
