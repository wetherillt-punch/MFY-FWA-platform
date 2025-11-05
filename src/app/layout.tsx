import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FWA Detection Platform',
  description: 'Fraud, Waste, and Abuse Detection for Healthcare Claims',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16 items-center">
                <div className="flex items-center">
                  <h1 className="text-2xl font-bold text-blue-600">FWA Detection</h1>
                </div>
                <div className="flex items-center space-x-4">
                  <a href="/" className="text-gray-700 hover:text-gray-900">Dashboard</a>
                  <a href="/leads" className="text-gray-700 hover:text-gray-900">Leads</a>
                </div>
              </div>
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  )
}
