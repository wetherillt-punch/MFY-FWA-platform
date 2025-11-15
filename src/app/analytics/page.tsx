'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface RuleStats {
  id: string;
  name: string;
  executionCount: number;
  totalTriggers: number;
  triggerRate: number;
  avgRiskScore: number;
  totalDollarImpact: number;
  category: string;
  severity: string;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<RuleStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const rulesResponse = await fetch('/api/rules');
      const rulesData = await rulesResponse.json();
      
      if (rulesData.success) {
        const ruleStats = await Promise.all(
          rulesData.rules.map(async (rule: any) => {
            const logsResponse = await fetch(`/api/rules/${rule.id}/logs?limit=100`);
            const logsData = await logsResponse.json();
            
            const logs = logsData.logs || [];
            const triggers = logs.filter((log: any) => log.triggered);
            
            const triggerRate = logs.length > 0 ? (triggers.length / logs.length) * 100 : 0;
            const avgRiskScore = logs.length > 0 
              ? logs.reduce((sum: number, log: any) => sum + (log.riskScore || 0), 0) / logs.length 
              : 0;
            const totalDollarImpact = triggers.reduce((sum: number, log: any) => {
              const impact = log.evidence?.estimated_dollar_impact || 0;
              return sum + impact;
            }, 0);
            
            return {
              id: rule.id,
              name: rule.name,
              executionCount: logs.length,
              totalTriggers: triggers.length,
              triggerRate: Math.round(triggerRate * 10) / 10,
              avgRiskScore: Math.round(avgRiskScore * 10) / 10,
              totalDollarImpact: Math.round(totalDollarImpact),
              category: rule.category,
              severity: rule.severity,
            };
          })
        );
        
        ruleStats.sort((a, b) => b.totalTriggers - a.totalTriggers);
        setStats(ruleStats);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalExecutions = stats.reduce((sum, s) => sum + s.executionCount, 0);
  const totalTriggers = stats.reduce((sum, s) => sum + s.totalTriggers, 0);
  const totalDollarImpact = stats.reduce((sum, s) => sum + s.totalDollarImpact, 0);
  const overallTriggerRate = totalExecutions > 0 
    ? Math.round((totalTriggers / totalExecutions) * 1000) / 10 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rule Analytics Dashboard</h1>
            <p className="mt-2 text-gray-600">Performance metrics and insights for detection rules</p>
          </div>
          <Link
            href="/rules"
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium text-gray-700"
          >
            ← Back to Rules
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-500">Total Executions</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">
                  {totalExecutions.toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-500">Total Triggers</div>
                <div className="mt-2 text-3xl font-bold text-orange-600">
                  {totalTriggers.toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-500">Trigger Rate</div>
                <div className="mt-2 text-3xl font-bold text-green-600">
                  {overallTriggerRate}%
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-500">Est. Dollar Impact</div>
                <div className="mt-2 text-3xl font-bold text-red-600">
                  ${(totalDollarImpact / 1000).toFixed(0)}K
                </div>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Top Performing Rules</h2>
            <p className="text-sm text-gray-600">Rules ranked by trigger count</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Executions</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Triggers</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Trigger Rate</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Risk Score</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Dollar Impact</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.slice(0, 10).map((rule, index) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-200 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {index + 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {rule.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {rule.executionCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-orange-600">
                        {rule.totalTriggers.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(rule.triggerRate, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-12 text-right">
                          {rule.triggerRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {rule.avgRiskScore.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">
                      ${(rule.totalDollarImpact / 1000).toFixed(1)}K
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Rule Efficiency Analysis</h3>
          <p className="text-sm text-gray-600 mb-4">
            Rules with high trigger rates are effectively catching anomalies. Rules with low rates may need refinement.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
              <div className="text-sm font-medium text-green-800 mb-2">High Efficiency (&gt;5%)</div>
              <div className="text-2xl font-bold text-green-600">
                {stats.filter(s => s.triggerRate > 5).length} rules
              </div>
            </div>
            <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
              <div className="text-sm font-medium text-yellow-800 mb-2">Medium Efficiency (1-5%)</div>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.filter(s => s.triggerRate >= 1 && s.triggerRate <= 5).length} rules
              </div>
            </div>
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <div className="text-sm font-medium text-red-800 mb-2">Low Efficiency (&lt;1%)</div>
              <div className="text-2xl font-bold text-red-600">
                {stats.filter(s => s.triggerRate < 1).length} rules
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
