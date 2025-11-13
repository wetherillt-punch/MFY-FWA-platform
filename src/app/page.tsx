'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, AlertTriangle, CheckCircle, FileText, TrendingUp, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [uploading, setUploading] = useState(false);
  const [data, setData] = useState<any>(null);
   useEffect(() => {
   const stored = sessionStorage.getItem('fwa_results');
   if (stored) {
    const restoredData = JSON.parse(stored);
    setData(restoredData);
  }
}, []);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
  // Try to restore from backup first (set when viewing lead detail)
  const backup = sessionStorage.getItem('fwa_dashboard_backup');
  if (backup) {
    try {
      const restoredData = JSON.parse(backup);
      if (restoredData.detection?.leads) {
        console.log('✅ Restored dashboard from backup:', {
          leadCount: restoredData.detection.leads.length,
          hasDetection: true
        });
        setData(restoredData);
        // Restore fwa_results to full data
        sessionStorage.setItem('fwa_results', backup);
        return;
      }
    } catch (e) {
      console.error('Failed to parse backup:', e);
    }
  }
  
  // Fallback to regular fwa_results
  const stored = sessionStorage.getItem('fwa_results');
  if (stored) {
    try {
      const restoredData = JSON.parse(stored);
      if (restoredData.detection?.leads) {
        console.log('✅ Restored data from sessionStorage:', {
          leadCount: restoredData.detection.leads.length,
          hasDetection: true
        });
        setData(restoredData);
      }
    } catch (e) {
      console.error('Failed to parse sessionStorage:', e);
      sessionStorage.removeItem('fwa_results');
    }
  }
}, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    // Clear ALL old storage
    sessionStorage.clear();

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (!response.ok) throw new Error('Upload failed');
        return response.json();
      })
      .then(result => {
  console.log('Upload successful:', result);
  console.log('Detection object:', result.detection);
  console.log('Leads array:', result.detection?.leads);
  setData(result);
  
  // ✅ STORE the full upload result
  sessionStorage.setItem('fwa_results', JSON.stringify(result));
  
  setUploading(false);
})
      .catch(err => {
        console.error('Upload error:', err);
        setError(err.message);
        setUploading(false);
      });
  };

  const handleNewUpload = () => {
    setData(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewDetails = (providerId: string) => {
  if (data) {
    const allClaims = data.detection?.allClaims || [];
    const specificLead = data.detection?.leads?.find((l: any) => l.provider_id === providerId);
    
    const leadDetailData = {
      lead: specificLead,
      fileName: data.fileName || 'unknown',
      allClaims: allClaims
    };
    
    // Store lead detail data (overwrites dashboard data temporarily)
    sessionStorage.setItem('fwa_results', JSON.stringify(leadDetailData));
    
    // ALSO keep full data in a backup key so we can restore dashboard
    sessionStorage.setItem('fwa_dashboard_backup', JSON.stringify(data));
  }
  router.push(`/leads/${providerId}`);
};

  const detection = data?.detection || {};
  const qualityReport = data?.qualityReport || {};
  const totalProviders = 68;
  
  // Sort leads by priority (HIGH → MEDIUM → WATCHLIST), then by score
  const leads = (data?.detection?.leads || []).sort((a: any, b: any) => {
    // Priority order: HIGH = 1, MEDIUM = 2, WATCHLIST = 3
    const priorityOrder: Record<string, number> = { 'HIGH': 1, 'MEDIUM': 2, 'WATCHLIST': 3 };
    const priorityDiff = (priorityOrder[a.priority] || 999) - (priorityOrder[b.priority] || 999);
    
    // Sort by priority first
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then by score (descending - highest first)
    return (b.overallScore || 0) - (a.overallScore || 0);
  });
  const leadCount = data?.detection?.leads?.length || 0;

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">FWA Detection Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload your claims data to detect fraud, waste, and abuse patterns.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Upload Claims Data</h2>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-700 mb-2">Drop your Excel file here</p>
            <p className="text-sm text-gray-500 mb-4">or click to browse</p>

            <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? 'Analyzing...' : 'Choose File'}
            </label>

            <p className="text-xs text-gray-500 mt-4">Supports .xlsx and .xls files up to 10MB</p>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 mb-2">Required columns:</p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li> <strong>claim_id</strong> - Unique claim identifier</li>
              <li> <strong>provider_id</strong> - Provider identifier</li>
              <li> <strong>service_date</strong> - Date of service</li>
              <li> <strong>billed_amount</strong> - Billed amount</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">FWA Detection Results</h1>
        <p className="mt-2 text-sm text-gray-600">
          File: {data.fileName} | Found <strong>{leadCount}</strong> FWA leads out of <strong>{totalProviders}</strong> providers
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8" ref={resultsRef}>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Total Providers</p>
            <FileText className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalProviders}</p>
          <p className="text-xs text-gray-500 mt-1">
            {qualityReport.totalRows?.toLocaleString() || 0} claims analyzed
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">FWA Leads</p>
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-orange-600">{leadCount}</p>
          <p className="text-xs text-gray-500 mt-1">
            {Math.round((leadCount / totalProviders) * 100)}% flagged
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">High Priority</p>
            <TrendingUp className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-red-600">{detection.highPriorityCount || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Tier 1 or 2 violations</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Data Quality</p>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-600">
            {qualityReport.qualityScore?.toFixed(0) || 100}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Quality score</p>
        </div>
      </div>

      {/* Provider Results Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Flagged Providers</h2>
          <p className="text-sm text-gray-600 mt-1">
            Sorted by priority (HIGH’ MEDIUM’ WATCHLIST)
          </p>
          <div className="flex gap-3 mt-4">
            <div className="px-4 py-2 bg-red-50 rounded-lg">
              <span className="text-2xl font-bold text-red-700">{detection.highPriorityCount || 0}</span>
              <span className="text-sm text-red-600 ml-2 font-medium">HIGH</span>
            </div>
            <div className="px-4 py-2 bg-yellow-50 rounded-lg">
              <span className="text-2xl font-bold text-yellow-700">{detection.mediumPriorityCount || 0}</span>
              <span className="text-sm text-yellow-600 ml-2 font-medium">MEDIUM</span>
            </div>
            <div className="px-4 py-2 bg-gray-50 rounded-lg">
              <span className="text-2xl font-bold text-gray-700">{detection.watchListCount || 0}</span>
              <span className="text-sm text-gray-600 ml-2 font-medium">WATCHLIST</span>
            </div>
          </div>
        </div>

        {leads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Provider ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Overall Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Tier Scores
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Anomalies
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Claims
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {leads.map((lead: any, index: number) => {
                  const score = lead.overallScore || 0;
                  const t1 = lead.tier1Metrics?.length || 0;
                  const t2 = lead.tier2Metrics?.length || 0;
                  const t3 = lead.tier3Metrics?.length || 0;
                  const t4 = lead.tier4Metrics?.length || 0;
                  const total = t1 + t2 + t3 + t4;

                  // Determine priority style
                  let priorityBg, priorityText, priorityIcon, barColor;
                  if (lead.priority === 'HIGH') {
                    priorityBg = 'bg-red-100';
                    priorityText = 'text-red-800';
                    priorityIcon = '';
                    barColor = '#EF4444';
                  } else if (lead.priority === 'MEDIUM') {
                    priorityBg = 'bg-yellow-100';
                    priorityText = 'text-yellow-800';
                    priorityIcon = '';
                    barColor = '#F59E0B';
                  } else {
                    priorityBg = 'bg-gray-100';
                    priorityText = 'text-gray-700';
                    priorityIcon = '';
                    barColor = '#9CA3AF';
                  }

                  return (
                    <tr key={lead.provider_id || index} className="hover:bg-gray-50 transition">
                      {/* Provider ID */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{lead.provider_id}</div>
                      </td>

                      {/* Overall Score with Bar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold text-gray-900 min-w-[3rem]">{score.toFixed(1)}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-3 w-32 overflow-hidden">
                            <div
                              className="h-3 rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, score)}%`,
                                backgroundColor: barColor
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Priority Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${priorityBg} ${priorityText}`}>
                          <span className="mr-1">{priorityIcon}</span>
                          {lead.priority}
                        </span>
                      </td>

                      {/* Tier Scores */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {t1 > 0 && (
                            <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                              T1:{t1}
                            </span>
                          )}
                          {t2 > 0 && (
                            <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-semibold">
                              T2:{t2}
                            </span>
                          )}
                          {t3 > 0 && (
                            <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">
                              T3:{t3}
                            </span>
                          )}
                          {t4 > 0 && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                              T4:{t4}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Anomalies */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{total} patterns</span>
                      </td>

                      {/* Claims */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{lead.claimCount || 0}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetails(lead.provider_id)}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-sm transition"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-gray-500">No flagged providers found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
