'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface DetectionRule {
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
  generatedCode: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  versions?: any[];
  tests?: any[];
}

export default function RuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [rule, setRule] = useState<DetectionRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchRule();
  }, []);

  const fetchRule = async () => {
    try {
      const response = await fetch(`/api/rules/${params.id}`);
      const data = await response.json();
      if (data.success) {
        setRule(data.rule);
      }
    } catch (error) {
      console.error('Error fetching rule:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async () => {
    if (!rule) return;
    
    try {
      const response = await fetch(`/api/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      
      if (response.ok) {
        fetchRule();
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const deleteRule = async () => {
    if (!rule || rule.isBuiltIn) return;
    
    if (!confirm(`Are you sure you want to delete "${rule.name}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/rules/${rule.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        router.push('/rules');
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    } finally {
      setDeleting(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'BILLING': return 'bg-blue-100 text-blue-800';
      case 'TEMPORAL': return 'bg-purple-100 text-purple-800';
      case 'NETWORK': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading rule details...</p>
        </div>
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Rule not found</h2>
          <Link href="/rules" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Rules
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/rules"
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-gray-900">{rule.name}</h1>
                  {rule.isBuiltIn && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                      Built-in
                    </span>
                  )}
                  {rule.status === 'PENDING' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                      Pending Approval
                    </span>
                  )}
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getCategoryColor(rule.category)}`}>
                    {rule.category}
                  </span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getSeverityColor(rule.severity)}`}>
                    {rule.severity}
                  </span>
                </div>
                <p className="mt-2 text-gray-600">{rule.description}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={toggleRule}
                className={`px-4 py-2 rounded-lg font-medium ${
                  rule.isActive
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {rule.isActive ? 'Deactivate' : 'Activate'}
              </button>
              {!rule.isBuiltIn && (
                <button
                  onClick={deleteRule}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Details Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Rule Details</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Tier</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{rule.tier}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${
                      rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created By</dt>
                  <dd className="mt-1 text-sm text-gray-900">{rule.createdBy}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created At</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(rule.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* CPT Codes */}
            {rule.cptCodes && rule.cptCodes.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">CPT Codes</h2>
                <div className="flex flex-wrap gap-2">
                  {rule.cptCodes.map((code, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-mono"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modifiers */}
            {rule.modifiers && rule.modifiers.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Modifiers</h2>
                <div className="flex flex-wrap gap-2">
                  {rule.modifiers.map((modifier, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-mono"
                    >
                      {modifier}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Thresholds */}
            {rule.thresholds && Object.keys(rule.thresholds).length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Thresholds</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <pre className="text-sm font-mono text-gray-800">
                    {JSON.stringify(rule.thresholds, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Generated Code */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Detection Logic</h2>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-green-400">
                  {rule.generatedCode}
                </pre>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Statistics</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-600">Version History</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {rule.versions?.length || 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Tests Run</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {rule.tests?.length || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Actions</h2>
              <div className="space-y-3">
                <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                  Test Rule
                </button>
                {!rule.isBuiltIn && (
                  <button className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium">
                    Edit Rule
                  </button>
                )}
                <button className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium">
                  View History
                </button>
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Metadata</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-600">Rule ID</dt>
                  <dd className="text-gray-900 font-mono text-xs break-all">{rule.id}</dd>
                </div>
                <div>
                  <dt className="text-gray-600">Last Updated</dt>
                  <dd className="text-gray-900">
                    {new Date(rule.updatedAt).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
