import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Lora } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme/theme-context";
import { ThemeBody } from "@/components/theme-body";

// Configure Inter font for body/paragraphs
// Inter is a variable font, supporting weights 100-900
// We'll use font-weight: 400 (regular) and 600 (semibold) via CSS classes
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Configure Lora font for headings
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pocket Genius",
  description: "Chat with creator content via RAG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        cssLayerName: "clerk", // Required for Tailwind CSS compatibility
      }}
    >
      <html lang="en" suppressHydrationWarning className={`${inter.variable} ${lora.variable}`}>
        <body suppressHydrationWarning>
          <ThemeProvider>
            <ThemeBody />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

