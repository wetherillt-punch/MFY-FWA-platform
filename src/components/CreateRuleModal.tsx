'use client';

import { useState } from 'react';

interface CreateRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateRuleModal({ isOpen, onClose, onSuccess }: CreateRuleModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'BILLING',
    severity: 'MEDIUM',
    tier: 'custom',
    cptCodes: '',
    modifiers: '',
    thresholds: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Parse arrays and JSON
      const cptCodesArray = formData.cptCodes
        .split(',')
        .map(c => c.trim())
        .filter(c => c);
      
      const modifiersArray = formData.modifiers
        .split(',')
        .map(m => m.trim())
        .filter(m => m);
      
      let thresholdsObj = {};
      if (formData.thresholds) {
        try {
          thresholdsObj = JSON.parse(formData.thresholds);
        } catch {
          setError('Invalid JSON in thresholds field');
          setLoading(false);
          return;
        }
      }

      const response = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          category: formData.category,
          severity: formData.severity,
          tier: formData.tier,
          cptCodes: cptCodesArray,
          modifiers: modifiersArray,
          thresholds: thresholdsObj,
          generatedCode: `export function detect${formData.name.replace(/\s+/g, '')}(claims) { return []; }`,
          createdBy: 'user',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create rule');
        setLoading(false);
        return;
      }

      // Success!
      setFormData({
        name: '',
        description: '',
        category: 'BILLING',
        severity: 'MEDIUM',
        tier: 'custom',
        cptCodes: '',
        modifiers: '',
        thresholds: '',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create rule');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create Custom Rule</h2>
              <p className="mt-1 text-sm text-gray-600">
                Define a new detection rule for fraud, waste, and abuse
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rule Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Excessive Same-Day Visits"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe what this rule detects..."
              />
            </div>

            {/* Category and Severity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="BILLING">Billing</option>
                  <option value="TEMPORAL">Temporal</option>
                  <option value="NETWORK">Network</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Severity *
                </label>
                <select
                  required
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
            </div>

            {/* CPT Codes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CPT Codes (comma-separated)
              </label>
              <input
                type="text"
                value={formData.cptCodes}
                onChange={(e) => setFormData({ ...formData, cptCodes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 99213, 99214, 99215"
              />
              <p className="mt-1 text-sm text-gray-500">
                Leave empty to apply to all codes
              </p>
            </div>

            {/* Modifiers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modifiers (comma-separated)
              </label>
              <input
                type="text"
                value={formData.modifiers}
                onChange={(e) => setFormData({ ...formData, modifiers: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 25, 59"
              />
            </div>

            {/* Thresholds */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Thresholds (JSON format)
              </label>
              <textarea
                value={formData.thresholds}
                onChange={(e) => setFormData({ ...formData, thresholds: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder='{"maxPerDay": 5, "minAmount": 1000}'
              />
              <p className="mt-1 text-sm text-gray-500">
                Define thresholds as JSON, e.g., {`{"maxPerDay": 5}`}
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    Custom rules will be marked as <strong>PENDING</strong> and require admin approval before activation.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Rule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
