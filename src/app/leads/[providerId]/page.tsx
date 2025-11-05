'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function LeadDetailPage() {
  const params = useParams()
  const providerId = params.providerId as string

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          ← Dashboard
        </Link>
      </div>
      <div className="bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-4">Lead: {providerId}</h1>
        <div className="mb-4">
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
            HIGH
          </span>
        </div>
        <p className="text-gray-600">Detailed lead analysis will appear here.</p>
      </div>
    </main>
  )
}
