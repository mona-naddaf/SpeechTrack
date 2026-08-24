import type { Metadata } from "next";
import { Baloo_2, Inter } from "next/font/google";
import "./globals.css";

// Rounded, friendly headings paired with a clean, highly-readable body
// face — warm without sacrificing legibility for daily clinical use.
const baloo = Baloo_2({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SpeechTrack",
  description: "Track your students' speech therapy progress",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${baloo.variable} ${inter.variable}`}>
      <body className="bg-cream-50 font-sans antialiased">{children}</body>
    </html>
  );
}
