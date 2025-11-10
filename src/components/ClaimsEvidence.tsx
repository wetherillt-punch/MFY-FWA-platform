'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Download, ExternalLink } from 'lucide-react'

interface Claim {
  service_date: string
  cpt_hcpcs: string
  modifiers: string
  billed_amount: string
  member_id: string
  place_of_service?: string
  diagnosis_code?: string
}

interface ClaimsEvidenceProps {
  claims: Claim[]
  ruleName: string
  highlightField?: string
  highlightValue?: string
  maxPreview?: number
}

export default function ClaimsEvidence({ 
  claims, 
  ruleName, 
  highlightField = '',
  highlightValue = '',
  maxPreview = 5 
}: ClaimsEvidenceProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showModal, setShowModal] = useState(false)

  if (!claims || claims.length === 0) return null

  const previewClaims = claims.slice(0, maxPreview)
  const hasMore = claims.length > maxPreview

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      })
    } catch {
      return date
    }
  }

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount)
    return isNaN(num) ? amount : `$${num.toLocaleString()}`
  }

  const shouldHighlight = (field: string, value: string) => {
    if (!highlightField || !highlightValue) return false
    return field === highlightField && String(value).includes(highlightValue)
  }

  const exportToCSV = () => {
    const headers = ['Service Date', 'CPT/HCPCS', 'Modifiers', 'Billed Amount', 'Member ID', 'POS', 'Diagnosis']
    const rows = claims.map(c => [
      c.service_date,
      c.cpt_hcpcs,
      c.modifiers || '',
      c.billed_amount,
      c.member_id,
      c.place_of_service || '',
      c.diagnosis_code || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${ruleName.replace(/\s+/g, '_')}_evidence.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-900 transition-colors"
      >
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        View Supporting Claims ({claims.length})
      </button>

      {isExpanded && (
        <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Service Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">CPT</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Mod</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Member</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewClaims.map((claim, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className={`px-3 py-2 whitespace-nowrap ${
                      shouldHighlight('service_date', claim.service_date) ? 'bg-yellow-100 font-semibold' : ''
                    }`}>
                      {formatDate(claim.service_date)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono">
                      {claim.cpt_hcpcs}
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap font-mono ${
                      shouldHighlight('modifiers', claim.modifiers) ? 'bg-yellow-100 font-bold' : ''
                    }`}>
                      {claim.modifiers || '-'}
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap ${
                      shouldHighlight('billed_amount', claim.billed_amount) ? 'font-bold text-red-700' : ''
                    }`}>
                      {formatAmount(claim.billed_amount)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {claim.member_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="bg-gray-50 px-3 py-2 text-center text-xs text-gray-600">
              Showing {maxPreview} of {claims.length} claims
            </div>
          )}

          <div className="bg-gray-50 px-3 py-2 flex gap-2 justify-end border-t border-gray-200">
            {hasMore && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-purple-700 hover:text-purple-900 hover:bg-purple-50 rounded transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                View All {claims.length} Claims
              </button>
            )}
            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              <Download className="w-3 h-3" />
              Export CSV
            </button>
          </div>
        </div>
      )}

      {/* Full Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                All Supporting Claims ({claims.length})
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Service Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">CPT/HCPCS</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Modifiers</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Billed Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Member ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">POS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {claims.map((claim, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className={`px-4 py-2 whitespace-nowrap ${
                        shouldHighlight('service_date', claim.service_date) ? 'bg-yellow-100' : ''
                      }`}>
                        {formatDate(claim.service_date)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap font-mono">{claim.cpt_hcpcs}</td>
                      <td className={`px-4 py-2 whitespace-nowrap font-mono ${
                        shouldHighlight('modifiers', claim.modifiers) ? 'bg-yellow-100 font-bold' : ''
                      }`}>
                        {claim.modifiers || '-'}
                      </td>
                      <td className={`px-4 py-2 whitespace-nowrap ${
                        shouldHighlight('billed_amount', claim.billed_amount) ? 'font-bold text-red-700' : ''
                      }`}>
                        {formatAmount(claim.billed_amount)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-600">{claim.member_id}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-600">{claim.place_of_service || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={exportToCSV}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export All to CSV
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
