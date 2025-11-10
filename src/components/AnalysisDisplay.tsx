'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Download, FileText } from 'lucide-react'

interface AnalysisDisplayProps {
  analysis: {
    summary: string
    comparative_analysis: {
      claims_per_month: {
        provider: number
        peer: number
        deviation_percent: number
        formatted_deviation: string
      }
      round_dollar_percent: {
        provider: number
        peer: number
        deviation_pp: number
        formatted_deviation: string
      }
      total_flagged: {
        provider: number
        peer: number
        deviation_percent: number
        formatted_deviation: string
      }
    }
    detection_rules_triggered: Array<{
      tier: string
      rule_name: string
      description: string
      threshold: string
      provider_value: string
      benchmark: string
      evidence: string
      severity: 'HIGH' | 'MEDIUM' | 'LOW'
      claims?: any[]
      highlightField?: string
    }>
    flagged_codes: Array<{
      code: string
      description: string
      count: number
      avg_amount: number
      total_amount: number
      formatted_avg: string
      formatted_total: string
    }>
    priority: string
    next_steps: string[]
    estimated_overpayment: number
    formatted_overpayment: string
  }
}

export default function AnalysisDisplay({ analysis }: AnalysisDisplayProps) {
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set())
  const [modalClaims, setModalClaims] = useState<{claims: any[], ruleName: string} | null>(null)

  const toggleRule = (index: number) => {
    const newExpanded = new Set(expandedRules)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedRules(newExpanded)
  }

  const openClaimsModal = (claims: any[], ruleName: string) => {
    setModalClaims({ claims, ruleName })
  }

  const closeClaimsModal = () => {
    setModalClaims(null)
  }

  const exportClaimsToCsv = (claims: any[], ruleName: string) => {
    if (!claims || claims.length === 0) return

    // CSV headers
    const headers = ['Claim ID', 'Service Date', 'CPT/HCPCS', 'Modifier', 'Billed Amount', 'Member ID', 'Place of Service', 'Diagnosis Code']
    
    // CSV rows
    const rows = claims.map(claim => [
      claim.claim_id || '',
      claim.service_date || '',
      claim.cpt_hcpcs || '',
      claim.modifier || claim.modifiers || '-',
      claim.billed_amount || '',
      claim.member_id || '',
      claim.place_of_service || '',
      claim.diagnosis_code || ''
    ])

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${ruleName.replace(/[^a-z0-9]/gi, '_')}_claims.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-300'
      case 'MEDIUM': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'LOW': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getHighlightClass = (field: string, highlightField?: string) => {
    if (!highlightField || field !== highlightField) return ''
    
    switch (highlightField) {
      case 'claim_id': return 'bg-red-50 font-semibold text-red-900'
      case 'billed_amount': return 'bg-yellow-50 font-semibold text-yellow-900'
      case 'service_date': return 'bg-orange-50 font-semibold text-orange-900'
      case 'modifiers': return 'bg-purple-50 font-semibold text-purple-900'
      default: return ''
    }
  }

  return (
    <div className="space-y-8">
      {/* Executive Summary */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Executive Summary</h3>
        <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Comparative Analysis */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparative Analysis</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Peer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deviation</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">Claims/month</td>
                <td className="px-6 py-4 text-sm text-gray-700">{analysis.comparative_analysis.claims_per_month.provider}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{analysis.comparative_analysis.claims_per_month.peer}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`font-semibold ${
                    analysis.comparative_analysis.claims_per_month.deviation_percent > 0 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                  {analysis.comparative_analysis.claims_per_month.formatted_deviation}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">Round $ %</td>
                <td className="px-6 py-4 text-sm text-gray-700">{analysis.comparative_analysis.round_dollar_percent.provider}%</td>
                <td className="px-6 py-4 text-sm text-gray-700">{analysis.comparative_analysis.round_dollar_percent.peer}%</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`font-semibold ${
                    analysis.comparative_analysis.round_dollar_percent.deviation_pp > 0 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                  {analysis.comparative_analysis.round_dollar_percent.formatted_deviation}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">Total flagged</td>
                <td className="px-6 py-4 text-sm text-gray-700">${analysis.comparative_analysis.total_flagged.provider}</td>
                <td className="px-6 py-4 text-sm text-gray-700">${analysis.comparative_analysis.total_flagged.peer}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`font-semibold ${
                    analysis.comparative_analysis.total_flagged.deviation_percent > 0 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                   {analysis.comparative_analysis.total_flagged.formatted_deviation}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detection Rules Triggered */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detection Rules Triggered</h3>
        <div className="space-y-4">
          {analysis.detection_rules_triggered.map((rule, index) => {
            const isExpanded = expandedRules.has(index)
            const hasClaims = rule.claims && rule.claims.length > 0

            return (
              <div key={index} className={`border-2 rounded-lg overflow-hidden ${getSeverityColor(rule.severity)}`}>
                <div className="p-4">
                  {/* Rule Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                          rule.tier.includes('1') ? 'bg-red-200 text-red-900' :
                          rule.tier.includes('2') ? 'bg-orange-200 text-orange-900' :
                          rule.tier.includes('3') ? 'bg-yellow-200 text-yellow-900' :
                          'bg-gray-200 text-gray-900'
                        }`}>
                          {rule.tier}
                        </span>
                        <h4 className="font-semibold text-gray-900">{rule.rule_name}</h4>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{rule.description}</p>
                      
                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600">Provider Value:</span>
                          <span className="ml-2 text-gray-900 font-semibold">{rule.provider_value}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Threshold:</span>
                          <span className="ml-2 text-gray-900">{rule.threshold}</span>
                        </div>
                        {rule.benchmark && (
                          <div>
                            <span className="font-medium text-gray-600">Benchmark:</span>
                            <span className="ml-2 text-gray-900">{rule.benchmark}</span>
                          </div>
                        )}
                      </div>

                      {rule.evidence && (
                        <div className="mt-2 p-2 bg-white bg-opacity-50 rounded text-sm text-gray-700">
                          <span className="font-medium">Evidence:</span> {rule.evidence}
                        </div>
                      )}
                    </div>

                    <span className={`ml-4 px-3 py-1 text-xs font-bold rounded-full ${
                      rule.severity === 'HIGH' ? 'bg-red-600 text-white' :
                      rule.severity === 'MEDIUM' ? 'bg-orange-600 text-white' :
                      'bg-yellow-600 text-white'
                    }`}>
                      {rule.severity}
                    </span>
                  </div>

                  {/* Claims Evidence Section */}
                  {hasClaims && (
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleRule(index)}
                          className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-gray-700"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          View Supporting Claims ({rule.claims.length})
                        </button>
                      </div>

                      {/* Claims Table */}
                      {isExpanded && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-full bg-white border border-gray-300 rounded text-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Service Date</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Claim ID</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">CPT</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Modifier</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {rule.claims.slice(0, 10).map((claim, claimIndex) => (
                                <tr key={claimIndex} className="hover:bg-gray-50">
                                  <td className={`px-3 py-2 ${getHighlightClass('service_date', rule.highlightField)}`}>
                                    {claim.service_date}
                                  </td>
                                  <td className={`px-3 py-2 ${getHighlightClass('claim_id', rule.highlightField)}`}>
                                    {claim.claim_id}
                                  </td>
                                  <td className="px-3 py-2">{claim.cpt_hcpcs}</td>
                                  <td className={`px-3 py-2 ${getHighlightClass('modifiers', rule.highlightField)}`}>
                                    {claim.modifier || claim.modifiers || '-'}
                                  </td>
                                  <td className={`px-3 py-2 font-medium ${getHighlightClass('billed_amount', rule.highlightField)}`}>
                                    ${parseFloat(claim.billed_amount || '0').toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {rule.claims.length > 10 && (
                            <div className="mt-3 flex items-center justify-between">
                              <p className="text-xs text-gray-600">
                                Showing 10 of {rule.claims.length} claims
                              </p>
                              <button
                                onClick={() => openClaimsModal(rule.claims, rule.rule_name)}
                                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded inline-flex items-center gap-2"
                              >
                                <FileText className="w-4 h-4" />
                                View All {rule.claims.length} Claims
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Flagged Codes */}
      {analysis.flagged_codes && analysis.flagged_codes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Flagged Codes</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analysis.flagged_codes.map((code, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{code.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{code.description}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{code.count}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{code.formatted_avg}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{code.formatted_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Investigation Priority & Next Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Investigation Priority</h3>
          <p className="text-2xl font-bold text-blue-700">
            {typeof analysis.priority === 'object' ? analysis.priority.label : analysis.priority}
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-green-900 mb-2">Estimated Overpayment</h3>
          <p className="text-2xl font-bold text-green-700">{analysis.formatted_overpayment}</p>
        </div>
      </div>

      {/* Next Steps */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended Next Steps</h3>
        <ul className="space-y-2">
          {analysis.next_steps.map((step, index) => (
            <li key={index} className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-sm font-bold mr-3 mt-0.5">
                {index + 1}
              </span>
              <span className="text-gray-700">{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Claims Modal */}
      {modalClaims && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">All Supporting Claims</h3>
                <p className="text-sm text-gray-600 mt-1">{modalClaims.ruleName} • {modalClaims.claims.length} claims</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => exportClaimsToCsv(modalClaims.claims, modalClaims.ruleName)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={closeClaimsModal}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable Table */}
            <div className="flex-1 overflow-auto p-6">
              <table className="min-w-full border border-gray-300 rounded-lg text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 border-b">Service Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 border-b">Claim ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 border-b">Member ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 border-b">CPT/HCPCS</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 border-b">Modifier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 border-b">Billed Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 border-b">Place of Service</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 border-b">Diagnosis Code</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {modalClaims.claims.map((claim, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">{claim.service_date}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{claim.claim_id}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{claim.member_id || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold">{claim.cpt_hcpcs}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{claim.modifier || claim.modifiers || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                        ${parseFloat(claim.billed_amount || '0').toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{claim.place_of_service || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{claim.diagnosis_code || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Total: <span className="font-semibold">{modalClaims.claims.length}</span> claims
                </p>
                <button
                  onClick={closeClaimsModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
