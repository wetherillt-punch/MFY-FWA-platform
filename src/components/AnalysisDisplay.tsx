interface AnalysisDisplayProps {
  analysis: any;
}

export default function AnalysisDisplay({ analysis }: AnalysisDisplayProps) {
  if (!analysis) return null;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-3">SUMMARY</h4>
        <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Comparative Analysis */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">COMPARATIVE ANALYSIS</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-50 border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">METRIC</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">PROVIDER</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">PEER</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">DEVIATION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">Claims/month</td>
                <td className="px-4 py-3 text-sm">{analysis.comparative_analysis.claims_per_month.provider}</td>
                <td className="px-4 py-3 text-sm">{analysis.comparative_analysis.claims_per_month.peer}</td>
                <td className={`px-4 py-3 text-sm font-semibold ${
                  analysis.comparative_analysis.claims_per_month.deviation_percent < 0 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {analysis.comparative_analysis.claims_per_month.formatted_deviation}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">Round-$ %</td>
                <td className="px-4 py-3 text-sm">{analysis.comparative_analysis.round_dollar_percent.provider}%</td>
                <td className="px-4 py-3 text-sm">{analysis.comparative_analysis.round_dollar_percent.peer}%</td>
                <td className={`px-4 py-3 text-sm font-semibold ${
                  analysis.comparative_analysis.round_dollar_percent.deviation_pp > 0 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {analysis.comparative_analysis.round_dollar_percent.formatted_deviation}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">Total flagged</td>
                <td className="px-4 py-3 text-sm">${analysis.comparative_analysis.total_flagged.provider?.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm">${analysis.comparative_analysis.total_flagged.peer?.toLocaleString()}</td>
                <td className={`px-4 py-3 text-sm font-semibold ${
                  analysis.comparative_analysis.total_flagged.deviation_percent < 0 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {analysis.comparative_analysis.total_flagged.formatted_deviation}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Flagged Codes */}
      {analysis.flagged_codes && analysis.flagged_codes.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">FLAGGED CODES</h4>
          <div className="space-y-2">
            {analysis.flagged_codes.map((code: any, idx: number) => (
              <div key={idx} className="text-sm">
                <span className="font-mono font-semibold">{code.code}</span> - {code.description}
                <div className="text-gray-600 ml-4">
                  {code.count} claims × {code.formatted_avg || `$${code.avg_amount}`} avg = {code.formatted_total || `$${code.total_amount}`} total
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investigation Priority */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-3">INVESTIGATION PRIORITY</h4>
        <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
          analysis.priority.color === 'red' ? 'bg-red-100 text-red-800' :
          analysis.priority.color === 'orange' ? 'bg-orange-100 text-orange-800' :
          analysis.priority.color === 'green' ? 'bg-green-100 text-green-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          ● {analysis.priority.label}
        </div>
      </div>

      {/* Next Steps */}
      {analysis.next_steps && analysis.next_steps.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">Next Steps:</h4>
          <ol className="list-decimal list-inside space-y-2">
            {analysis.next_steps.map((step: string, idx: number) => (
              <li key={idx} className="text-sm text-gray-700">{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Estimated Overpayment */}
      {analysis.estimated_overpayment > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-700">
            Estimated Overpayment: <span className="text-2xl font-bold text-red-600">{analysis.formatted_overpayment}</span>
          </div>
        </div>
      )}
    </div>
  );
}
