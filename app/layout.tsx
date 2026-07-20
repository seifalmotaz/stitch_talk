import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Figtree,
  JetBrains_Mono,
  Source_Serif_4,
} from "next/font/google";
import "./globals.css";
import { BackendProvider } from "@/components/providers/BackendProvider";
import { clerkAppearance } from "@/lib/clerk-appearance";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ui = Figtree({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const read = Source_Serif_4({
  variable: "--font-read",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Stitch Talk — design the feel before you build",
  description:
    "A chat-first design atelier that helps you figure out the look, feel, and direction of your UI before any generation tool takes over.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${ui.variable} ${read.variable} ${mono.variable} h-full`}
    >
      <body className="h-full">
        <ClerkProvider appearance={clerkAppearance}>
          <BackendProvider>{children}</BackendProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}