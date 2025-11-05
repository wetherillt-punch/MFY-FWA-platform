import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FWA Detection Platform',
  description: 'Fraud, Waste, and Abuse Detection for Healthcare Claims',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {/* Navigation */}
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16 items-center">
                <div className="flex items-center">
                  <Link href="/">
                    <h1 className="text-2xl font-bold text-blue-600 cursor-pointer">
                      FWA Detection
                    </h1>
                  </Link>
                </div>
                <div className="flex items-center space-x-4">
                  <Link
                    href="/"
                    className="text-gray-700 hover:text-gray-900 font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/rules"
                    className="text-gray-700 hover:text-gray-900 font-medium"
                  >
                    Rules
                  </Link>
                  <Link
                    href="/leads"
                    className="text-gray-700 hover:text-gray-900 font-medium"
                  >
                    Leads
                  </Link>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          {children}
        </div>
      </body>
    </html>
  );
}
