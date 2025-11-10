'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, TrendingUp, Activity, Sparkles, Loader2, Info } from 'lucide-react'
import AnalysisDisplay from '@/components/AnalysisDisplay'

export default function LeadDetailPage() {
  const params = useParams()
  const [leadData, setLeadData] = useState<any>(null)
  const [agentAnalysis, setAgentAnalysis] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('fwa_results')
    if (stored) {
      const results = JSON.parse(stored)
      const lead = results.detection.leads.find((l: any) => l.provider_id === params.providerId)
      if (lead) {
        setLeadData({ ...lead, fileName: results.fileName })
      }
    }
  }, [params.providerId])

  const analyzeWithAI = async () => {
    if (!leadData) return
    
    setIsAnalyzing(true)
    try {
      // Get all claims from sessionStorage
      const stored = sessionStorage.getItem('fwa_results')
      const allClaims = stored ? JSON.parse(stored).allClaims || [] : []
      
      const response = await fetch('/api/agent/analyze-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lead: leadData,
          allClaims: allClaims 
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setAgentAnalysis(data.analysis)
      }
    } catch (error) {
      console.error('Agent analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (!leadData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-500">Lead not found.</p>
          <Link href="/" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            ← Back to Leads
          </Link>
        </div>
      </div>
    )
  }

  const allMetrics = [
    ...leadData.tier1Metrics,
    ...leadData.tier2Metrics,
    ...leadData.tier3Metrics,
    ...leadData.tier4Metrics,
  ]

  const tierDescriptions = [
    { tier: 1, score: leadData.tier1Score, title: "Obvious Red Flags", description: "Clear violations", icon: "🚨", severity: "Critical" },
    { tier: 2, score: leadData.tier2Score, title: "Statistical Outliers", description: "Unusual vs peers", icon: "📊", severity: "High" },
    { tier: 3, score: leadData.tier3Score, title: "Suspicious Patterns", description: "Template billing", icon: "🔍", severity: "Medium" },
    { tier: 4, score: leadData.tier4Score, title: "Emerging Trends", description: "Early warnings", icon: "📈", severity: "Watch" }
  ]

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Leads
      </Link>

      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Provider {leadData.provider_id}</h1>
            <p className="text-gray-500 mt-1">From: {leadData.fileName}</p>
          </div>
          <span className={`px-4 py-2 text-sm font-semibold rounded-full ${
              leadData.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
              leadData.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
            {leadData.priority} PRIORITY
          </span>
        </div>
      </div>

      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-6 border-2 border-red-200 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">Overall FWA Score</div>
            <div className="text-5xl font-bold text-red-600">{leadData.overallScore.toFixed(1)}</div>
            <p className="text-sm text-gray-600 mt-2">Combined score</p>
          </div>
          <AlertTriangle className="w-16 h-16 text-red-400" />
        </div>
        
        <div className="mt-6 pt-6 border-t border-red-200">
          <div className="flex items-center mb-4">
            <Info className="w-5 h-5 text-indigo-600 mr-2" />
            <h3 className="text-sm font-semibold text-gray-900">Detection Breakdown</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tierDescriptions.map((tier) => (
              <div key={tier.tier} className={`bg-white rounded-lg p-4 border-2 ${tier.score > 0 ? 'border-red-300 shadow-md' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">{tier.icon}</span>
                    <div>
                      <div className="font-semibold text-gray-900">Tier {tier.tier}: {tier.title}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        tier.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                        tier.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                        tier.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{tier.severity}</span>
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${
                    tier.score > 70 ? 'text-red-600' : tier.score > 40 ? 'text-orange-600' : tier.score > 0 ? 'text-yellow-600' : 'text-gray-400'
                  }`}>{tier.score.toFixed(0)}</div>
                </div>
                <p className="text-xs text-gray-600">{tier.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-500">Total Claims</div>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{leadData.claimCount}</div>
          <p className="text-xs text-gray-500 mt-1">Claims analyzed</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-500">Patterns</div>
            <TrendingUp className="w-5 h-5 text-orange-400" />
          </div>
          <div className="text-3xl font-bold text-orange-600">{allMetrics.length}</div>
          <p className="text-xs text-gray-500 mt-1">Anomalies</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-500">Risk Level</div>
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-600">{leadData.priority}</div>
          <p className="text-xs text-gray-500 mt-1">
            {leadData.priority === 'HIGH' ? 'Immediate investigation' : leadData.priority === 'MEDIUM' ? 'Surveillance warranted' : 'Monitor'}
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border-2 border-purple-200 mb-8">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">AI Analysis & Recommendations</h3>
            </div>
            
            {!agentAnalysis ? (
              <>
                <p className="text-gray-600 mb-4">Detailed analysis with CPT codes and investigation steps.</p>
                <button
                  onClick={analyzeWithAI}
                  disabled={isAnalyzing}
                  className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
                >
                  {isAnalyzing ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Analyzing...</>
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" />Generate AI Analysis</>
                  )}
                </button>
              </>
            ) : (
              <div className="bg-white rounded-lg p-8 border border-purple-200">
                <AnalysisDisplay analysis={agentAnalysis} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
