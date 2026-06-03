import type { Metadata } from "next";
import { DM_Mono, Hanken_Grotesk, Newsreader } from "next/font/google";
import { ProfileProvider } from "@/contexts/profile-context";
import "./globals.css";

const displayFont = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

const bodyFont = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const monoFont = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SMU Career Companion",
  description:
    "Career intelligence for SMU Masters students: interview prep, job board, and GitHub resource discovery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <ProfileProvider>{children}</ProfileProvider>
      </body>
    </html>
  );
}
