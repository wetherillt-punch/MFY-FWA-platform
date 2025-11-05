'use client'

import { useState } from 'react'
import Link from 'next/link'
import FileUpload from '@/components/FileUpload'
import { AlertTriangle, TrendingUp, Users, FileText } from 'lucide-react'

export default function Home() {
  const [results, setResults] = useState<any>(null)
  const [isSyntheticRunning, setIsSyntheticRunning] = useState(false)

  const runSyntheticDetection = async () => {
    setIsSyntheticRunning(true)
    setResults(null)
    try {
      const response = await fetch('/api/detect-synthetic', {
        method: 'POST',
      })
      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsSyntheticRunning(false)
    }
  }

  const handleUploadComplete = (uploadResult: any) => {
    setResults({
      source: 'upload',
      fileName: uploadResult.fileName,
      totalProviders: uploadResult.parseResult.stats.uniqueProviders,
      totalClaims: uploadResult.parseResult.stats.totalRows,
      leadCount: uploadResult.detection.leadCount,
      highPriorityCount: uploadResult.detection.highPriorityCount,
      mediumPriorityCount: uploadResult.detection.mediumPriorityCount,
      watchlistCount: uploadResult.detection.watchlistCount,
      leads: uploadResult.detection.leads,
      qualityScore: uploadResult.qualityReport.qualityScore,
      datasetHash: uploadResult.datasetHash,
    })
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">FWA Detection Dashboard</h2>
        <p className="text-gray-600">
          Upload your claims data or test with synthetic data to detect fraud, waste, and abuse patterns.
        </p>
      </div>

      {/* Stats Cards */}
      {results && (
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
              Tier 1 or 2 violations
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
      )}

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-8 mb-8">
        <h3 className="text-xl font-semibold mb-6">Upload Claims Data</h3>
        <FileUpload onUploadComplete={handleUploadComplete} />
      </div>

      {/* OR Divider */}
      <div className="relative mb-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-gray-50 text-gray-500">OR</span>
        </div>
      </div>

      {/* Synthetic Test Section */}
      <div className="bg-white rounded-lg shadow p-8 mb-8">
        <h3 className="text-xl font-semibold mb-4">Test with Synthetic Data</h3>
        <p className="text-gray-600 mb-6">
          Run detection on synthetic test data with known anomalies (50 normal providers, 10 anomalous).
        </p>
        <button
          onClick={runSyntheticDetection}
          disabled={isSyntheticRunning}
          className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSyntheticRunning ? 'Processing...' : 'Run Synthetic Detection'}
        </button>
      </div>

      {/* Results Table */}
      {results && results.leads && results.leads.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Detection Results</h3>
              {results.source === 'upload' && (
                <p className="text-sm text-gray-500 mt-1">
                  File: {results.fileName} | Dataset: {results.datasetHash?.substring(0, 8)}...
                </p>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Showing {results.leads.length} provider{results.leads.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Provider ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overall Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tier Scores
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Anomalies
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Claims
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.leads.map((lead: any) => (
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

      {results && results.leads && results.leads.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 mb-4">
            <AlertTriangle className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No FWA Leads Detected</h3>
          <p className="text-gray-600">
            All providers passed the detection criteria. No anomalies found.
          </p>
        </div>
      )}
    </main>
  )
}
