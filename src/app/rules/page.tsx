'use client';

import { useState, useEffect, useRef } from 'react';
import CreateRuleModal from '@/components/CreateRuleModal';
import EditRuleModal from '@/components/EditRuleModal';

interface Rule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  tier: string;
  isBuiltIn: boolean;
  isActive: boolean;
  status: string;
  cptCodes: string[];
  modifiers: string[];
  thresholds: any;
  executionCount: number;
  totalTriggers: number;
  lastExecuted: string | null;
  createdAt: string;
  createdBy: string;
}

interface ExecutionLog {
  id: string;
  ruleId: string;
  providerId: string;
  providerName: string;
  triggered: boolean;
  riskScore: number;
  evidence: any;
  executedAt: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Test modal state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rules');
      const data = await response.json();
      if (data.success) {
        setRules(data.rules);
      }
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (ruleId: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });

      if (response.ok) {
        loadRules();
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const deleteRule = async (ruleId: string, ruleName: string) => {
    if (!confirm(`Are you sure you want to delete "${ruleName}"?`)) return;

    try {
      const response = await fetch(`/api/rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadRules();
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const openEditModal = (rule: Rule) => {
    setSelectedRule(rule);
    setShowEditModal(true);
  };

  const openDetailModal = (rule: Rule) => {
    setSelectedRule(rule);
    setShowDetailModal(true);
  };

  const openTestModal = (rule: Rule) => {
    setSelectedRule(rule);
    setSelectedFile(null);
    setTestResults(null);
    setShowTestModal(true);
  };

  const openHistoryModal = async (rule: Rule) => {
    setSelectedRule(rule);
    setShowHistoryModal(true);
    setLoadingLogs(true);
    
    try {
      const response = await fetch(`/api/rules/${rule.id}/logs?limit=50`);
      const data = await response.json();
      if (data.success) {
        setExecutionLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      setExecutionLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      const validTypes = ['.csv', '.xlsx', '.xls'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!validTypes.includes(fileExtension)) {
        alert('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
        return;
      }
      
      setSelectedFile(file);
      setTestResults(null);
    }
  };

  const handleTestRule = async () => {
    if (!selectedFile || !selectedRule) return;
    
    setTestLoading(true);
    setTestResults(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await fetch(`/api/rules/${selectedRule.id}/test`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTestResults(data);
      } else {
        alert(data.error || 'Failed to test rule');
      }
    } catch (error) {
      console.error('Failed to test rule:', error);
      alert('Failed to test rule. Please try again.');
    } finally {
      setTestLoading(false);
    }
  };

  const filteredRules = rules.filter((rule) => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'active') return matchesSearch && rule.isActive;
    if (filter === 'inactive') return matchesSearch && !rule.isActive;
    if (filter === 'builtin') return matchesSearch && rule.isBuiltIn;
    if (filter === 'custom') return matchesSearch && !rule.isBuiltIn;
    
    return matchesSearch;
  });

  const stats = {
    total: rules.length,
    active: rules.filter(r => r.isActive).length,
    builtin: rules.filter(r => r.isBuiltIn).length,
    custom: rules.filter(r => !r.isBuiltIn).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Detection Rules</h1>
          <p className="mt-2 text-gray-600">
            Manage fraud, waste, and abuse detection rules
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Rules</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Active</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{stats.active}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Built-in</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">{stats.builtin}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Custom</div>
            <div className="mt-2 text-3xl font-bold text-purple-600">{stats.custom}</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search rules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Rules</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
                <option value="builtin">Built-in Only</option>
                <option value="custom">Custom Only</option>
              </select>

              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Rule
              </button>
            </div>
          </div>
        </div>

        {/* Rules Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rule Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                    <div className="text-sm text-gray-500">{rule.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {rule.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      rule.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                      rule.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                      rule.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {rule.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      rule.isBuiltIn ? 'bg-gray-100 text-gray-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {rule.isBuiltIn ? 'Built-in' : 'Custom'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleActive(rule.id, rule.isActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        rule.isActive ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openDetailModal(rule)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View details"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>

                      <button
                        onClick={() => openEditModal(rule)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit rule"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      <button
                        onClick={() => openTestModal(rule)}
                        className="text-green-600 hover:text-green-900"
                        title="Test rule"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>

                      <button
                        onClick={() => openHistoryModal(rule)}
                        className="text-purple-600 hover:text-purple-900"
                        title="View execution history"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>

                      {!rule.isBuiltIn && (
                        <button
                          onClick={() => deleteRule(rule.id, rule.name)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete rule"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRules.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow mt-6">
            <p className="text-gray-500">No rules found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateRuleModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadRules}
      />

      {/* Edit Modal */}
      <EditRuleModal
        isOpen={showEditModal}
        rule={selectedRule}
        onClose={() => {
          setShowEditModal(false);
          setSelectedRule(null);
        }}
        onSuccess={loadRules}
      />

      {/* Detail Modal */}
      {showDetailModal && selectedRule && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowDetailModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-2xl font-bold text-gray-900">Rule Details</h2>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Name</h3>
                  <p className="mt-1 text-lg font-semibold">{selectedRule.name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Description</h3>
                  <p className="mt-1 text-gray-900">{selectedRule.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Category</h3>
                    <p className="mt-1">{selectedRule.category}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Severity</h3>
                    <p className="mt-1">{selectedRule.severity}</p>
                  </div>
                </div>
                {selectedRule.cptCodes && selectedRule.cptCodes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">CPT Codes</h3>
                    <p className="mt-1">{selectedRule.cptCodes.join(', ')}</p>
                  </div>
                )}
                {selectedRule.thresholds && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Thresholds</h3>
                    <pre className="mt-1 p-3 bg-gray-50 rounded text-sm">{JSON.stringify(selectedRule.thresholds, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && selectedRule && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowTestModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Test Rule</h2>
                  <p className="text-sm text-gray-600 mt-1">{selectedRule.name}</p>
                </div>
                <button onClick={() => setShowTestModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6">
                <p className="text-gray-600 mb-4">Upload a CSV or Excel file to test this rule:</p>
                
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {/* Upload area */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500 mt-1">CSV, XLSX, or XLS files</p>
                </div>
                
                {/* Selected file display */}
                {selectedFile && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                          <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setTestResults(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Test button */}
                {selectedFile && !testResults && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleTestRule}
                      disabled={testLoading}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testLoading ? 'Testing...' : 'Run Test'}
                    </button>
                  </div>
                )}
                
                {/* Test results */}
                {testResults && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-3">Test Results</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Claims Analyzed:</span>
                        <span className="font-medium">{testResults.totalClaims || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Violations Found:</span>
                        <span className="font-medium text-orange-600">{testResults.violations || 0}</span>
                      </div>
                      {testResults.violations > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-gray-600 mb-2">Sample Violations:</p>
                          <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                            {JSON.stringify(testResults.sampleViolations || [], null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedRule && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowHistoryModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Execution History</h2>
                  <p className="text-sm text-gray-600 mt-1">{selectedRule.name}</p>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {loadingLogs ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading execution logs...</p>
                </div>
              ) : executionLogs.length > 0 ? (
                <div className="p-6">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">Total Executions</div>
                      <div className="text-2xl font-bold">{executionLogs.length}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">Triggers</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {executionLogs.filter(log => log.triggered).length}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">Success Rate</div>
                      <div className="text-2xl font-bold text-green-600">
                        {Math.round((executionLogs.filter(log => log.triggered).length / executionLogs.length) * 100)}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Executed At</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Risk Score</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Triggered</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {executionLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(log.executedAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="font-medium text-gray-900">{log.providerName || 'Unknown'}</div>
                              <div className="text-xs text-gray-500">{log.providerId}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium">
                              {log.riskScore ? log.riskScore.toFixed(1) : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {log.triggered ? (
                                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Yes</span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-gray-500">No execution history found for this rule.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
