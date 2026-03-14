import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reddit to YouTube (RTY)",
  description: "Generate YouTube video content ideas from Reddit threads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-900 text-white min-h-screen`}
      >
        <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <Link href="/" className="text-xl font-bold text-orange-500 hover:text-orange-400">
                  Reddit → YouTube
                </Link>
                <div className="flex space-x-4">
                  <Link href="/" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                    Browse
                  </Link>
                  <Link href="/ideas" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                    Saved Ideas
                  </Link>
                  <Link href="/viral-references" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                    🔥 Viral
                  </Link>
                  <Link href="/settings" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                    Settings
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
