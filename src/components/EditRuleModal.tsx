'use client';

import { useState, useEffect } from 'react';

interface Rule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  tier: string;
  cptCodes: string[];
  modifiers: string[];
  thresholds: any;
  isBuiltIn: boolean;
}

interface EditRuleModalProps {
  isOpen: boolean;
  rule: Rule | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditRuleModal({ isOpen, rule, onClose, onSuccess }: EditRuleModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'BILLING',
    severity: 'MEDIUM',
    cptCodes: '',
    modifiers: '',
    thresholds: '',
  });

  // Populate form when rule changes
  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name,
        description: rule.description,
        category: rule.category,
        severity: rule.severity,
        cptCodes: rule.cptCodes?.join(', ') || '',
        modifiers: rule.modifiers?.join(', ') || '',
        thresholds: rule.thresholds ? JSON.stringify(rule.thresholds, null, 2) : '',
      });
    }
  }, [rule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rule) return;
    
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

      const response = await fetch(`/api/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          category: formData.category,
          severity: formData.severity,
          cptCodes: cptCodesArray,
          modifiers: modifiersArray,
          thresholds: thresholdsObj,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update rule');
        setLoading(false);
        return;
      }

      // Success!
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update rule');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !rule) return null;

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
              <h2 className="text-2xl font-bold text-gray-900">Edit Rule</h2>
              <p className="mt-1 text-sm text-gray-600">
                Modify detection rule configuration
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

            {/* Built-in Warning */}
            {rule.isBuiltIn && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Built-in Rule:</strong> Modifications to built-in rules should be done carefully as they affect system-wide detection.
                    </p>
                  </div>
                </div>
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
                  <option value="CODING">Coding</option>
                  <option value="FREQUENCY">Frequency</option>
                  <option value="PATTERN">Pattern</option>
                  <option value="DOCUMENTATION">Documentation</option>
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
                  <option value="CRITICAL">Critical</option>
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
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder='{"maxPerDay": 5, "minAmount": 1000}'
              />
              <p className="mt-1 text-sm text-gray-500">
                Define thresholds as JSON, e.g., {`{"maxPerDay": 5, "minAmount": 1000}`}
              </p>
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
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
