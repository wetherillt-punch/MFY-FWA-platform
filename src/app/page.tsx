'use client'

import { useState, useEffect } from 'react'
import FileUpload from '@/components/FileUpload'
import Link from 'next/link'
import { AlertTriangle, TrendingUp, Users, FileText, RefreshCw, CheckCircle, Eye, FileSpreadsheet } from 'lucide-react'

export default function Home() {
  const [results, setResults] = useState<any>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('fwa_results')
    if (stored) {
      setResults(JSON.parse(stored))
    }
  }, [])

  const handleUploadComplete = (uploadResult: any) => {
    const newResults = {
      fileName: uploadResult.fileName,
      totalProviders: uploadResult.parseResult.stats.uniqueProviders,
      totalClaims: uploadResult.parseResult.stats.totalRows,
      leadCount: uploadResult.detection.leadCount,
      highPriorityCount: uploadResult.detection.highPriorityCount,
      mediumPriorityCount: uploadResult.detection.mediumPriorityCount,
      watchlistCount: uploadResult.detection.watchlistCount,
      leads: uploadResult.detection.leads,
      qualityScore: uploadResult.qualityReport.qualityScore,
    }
    
    setResults(newResults)
    sessionStorage.setItem('fwa_results', JSON.stringify(newResults))
  }

  const clearResults = () => {
    setResults(null)
    sessionStorage.removeItem('fwa_results')
  }

  // Sort leads by priority: HIGH -> MEDIUM -> WATCHLIST
  const getSortedLeads = (leads: any[]) => {
    const priorityOrder: any = { HIGH: 1, MEDIUM: 2, WATCHLIST: 3 };
    return [...leads].sort((a, b) => {
      const orderDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (orderDiff !== 0) return orderDiff;
      // If same priority, sort by score (highest first)
      return b.overallScore - a.overallScore;
    });
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">FWA Detection Dashboard</h2>
            <p className="text-gray-600">
              Upload your claims data to detect fraud, waste, and abuse patterns.
            </p>
          </div>
          {results && (
            <button
              onClick={clearResults}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              New Upload
            </button>
          )}
        </div>
      </div>

      {results && (
        <>
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-8 border-2 border-indigo-200 shadow-lg mb-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-indigo-600 rounded-lg p-3">
                <FileSpreadsheet className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Claims File Assessment
                </h3>
                <p className="text-indigo-900 font-medium text-lg">
                  {results.fileName}
                </p>
              </div>
            </div>

            <div className="bg-white/60 rounded-lg p-6 mb-6">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Eye className="w-5 h-5 mr-2 text-indigo-600" />
                Dataset Overview
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Claims:</span>
                  <span className="ml-2 font-bold text-gray-900">{results.totalClaims.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Providers:</span>
                  <span className="ml-2 font-bold text-gray-900">{results.totalProviders}</span>
                </div>
                <div>
                  <span className="text-gray-600">Data Quality:</span>
                  <span className="ml-2 font-bold text-green-600">{results.qualityScore?.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
                Detection Summary
              </h4>
              
              {results.leadCount === 0 ? (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                  <div className="flex items-center">
                    <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
                    <div>
                      <p className="text-lg font-semibold text-green-900">
                        ✓ All Providers Compliant
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        No FWA leads detected across {results.totalProviders} providers.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-white/80 rounded-lg p-5 border-l-4 border-red-500">
                    <p className="text-base text-gray-900 leading-relaxed">
                      <strong className="text-red-600 text-lg">{results.leadCount} FWA Leads Detected</strong> 
                      <span className="text-gray-600 ml-2">
                        ({((results.leadCount / results.totalProviders) * 100).toFixed(1)}% of providers flagged)
                      </span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {results.highPriorityCount > 0 && (
                      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <AlertTriangle className="w-6 h-6 text-red-600" />
                          <span className="text-3xl font-bold text-red-600">{results.highPriorityCount}</span>
                        </div>
                        <h5 className="font-semibold text-red-900 mb-1">HIGH Priority</h5>
                        <p className="text-xs text-red-700">
                          Immediate investigation recommended
                        </p>
                      </div>
                    )}

                    {results.mediumPriorityCount > 0 && (
                      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <TrendingUp className="w-6 h-6 text-yellow-600" />
                          <span className="text-3xl font-bold text-yellow-600">{results.mediumPriorityCount}</span>
                        </div>
                        <h5 className="font-semibold text-yellow-900 mb-1">MEDIUM Priority</h5>
                        <p className="text-xs text-yellow-700">
                          Ongoing surveillance warranted
                        </p>
                      </div>
                    )}

                    {results.watchlistCount > 0 && (
                      <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Eye className="w-6 h-6 text-gray-600" />
                          <span className="text-3xl font-bold text-gray-600">{results.watchlistCount}</span>
                        </div>
                        <h5 className="font-semibold text-gray-900 mb-1">WATCHLIST</h5>
                        <p className="text-xs text-gray-700">
                          Monitor for escalation
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5">
                    <h5 className="font-semibold text-indigo-900 mb-3">📋 Recommended Actions</h5>
                    <ul className="space-y-2 text-sm text-indigo-900">
                      {results.highPriorityCount > 0 && (
                        <li className="flex items-start">
                          <span className="text-red-600 mr-2">•</span>
                          <span>Review {results.highPriorityCount} HIGH priority provider{results.highPriorityCount > 1 ? 's' : ''}</span>
                        </li>
                      )}
                      {results.mediumPriorityCount > 0 && (
                        <li className="flex items-start">
                          <span className="text-yellow-600 mr-2">•</span>
                          <span>Establish surveillance for {results.mediumPriorityCount} MEDIUM priority case{results.mediumPriorityCount > 1 ? 's' : ''}</span>
                        </li>
                      )}
                      {results.watchlistCount > 0 && (
                        <li className="flex items-start">
                          <span className="text-gray-600 mr-2">•</span>
                          <span>Add {results.watchlistCount} provider{results.watchlistCount > 1 ? 's' : ''} to watchlist</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-500">Total Providers</div>
                <Users className="w-5 h-5 text-gray-400" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {results.totalProviders}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {results.totalClaims.toLocaleString()} claims analyzed
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-500">FWA Leads</div>
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-3xl font-bold text-red-600">
                {results.leadCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {((results.leadCount / results.totalProviders) * 100).toFixed(1)}% flagged
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-500">High Priority</div>
                <TrendingUp className="w-5 h-5 text-orange-400" />
              </div>
              <div className="text-3xl font-bold text-orange-600">
                {results.highPriorityCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Immediate action needed
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-500">Data Quality</div>
                <FileText className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-3xl font-bold text-green-600">
                {results.qualityScore?.toFixed(0) || '--'}%
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Quality score
              </p>
            </div>
          </div>
        </>
      )}

      {!results && (
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h3 className="text-xl font-semibold mb-6">Upload Claims Data</h3>
          <FileUpload onUploadComplete={handleUploadComplete} />
        </div>
      )}

      {results && results.leads && results.leads.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-semibold">Flagged Providers</h3>
            <p className="text-sm text-gray-500 mt-1">
              Sorted by priority (HIGH → MEDIUM → WATCHLIST)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Provider ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Overall Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tier Scores
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Anomalies
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Claims
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getSortedLeads(results.leads).map((lead: any) => (
                  <tr key={lead.provider_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {lead.provider_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-semibold text-gray-900">
                          {lead.overallScore.toFixed(1)}
                        </div>
                        <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              lead.overallScore >= 70
                                ? 'bg-red-600'
                                : lead.overallScore >= 50
                                ? 'bg-orange-500'
                                : 'bg-yellow-500'
                            }`}
                            style={{ width: `${Math.min(lead.overallScore, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          lead.priority === 'HIGH'
                            ? 'bg-red-100 text-red-800'
                            : lead.priority === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {lead.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                      T1:{lead.tier1Score.toFixed(0)} T2:{lead.tier2Score.toFixed(0)} T3:
                      {lead.tier3Score.toFixed(0)} T4:{lead.tier4Score.toFixed(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.tier1Metrics.length + lead.tier2Metrics.length + lead.tier3Metrics.length + lead.tier4Metrics.length} patterns
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.claimCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Link
                        href={`/leads/${lead.provider_id}`}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && results.leadCount === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No FWA Leads Detected</h3>
          <p className="text-gray-600">
            All {results.totalProviders} providers appear compliant.
          </p>
        </div>
      )}
    </main>
  )
}
