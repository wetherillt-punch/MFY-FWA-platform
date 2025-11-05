'use client'

import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface FileUploadProps {
  onUploadComplete: (result: any) => void
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      await handleFile(files[0])
    }
  }, [])

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await handleFile(files[0])
    }
  }, [])

  const handleFile = async (file: File) => {
    setError(null)
    setFileName(file.name)

    // Check file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Please upload an Excel file (.xlsx or .xls)')
      return
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      console.log('Upload successful:', result)
      onUploadComplete(result)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
        } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <div>
              <p className="text-lg font-medium text-gray-900">Processing {fileName}...</p>
              <p className="text-sm text-gray-500 mt-1">
                Parsing data and running FWA detection
              </p>
            </div>
          </div>
        ) : (
          <>
            <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl font-medium text-gray-900 mb-2">
              Drop your Excel file here
            </p>
            <p className="text-sm text-gray-500 mb-6">
              or click to browse
            </p>
            <label className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
              <Upload className="w-5 h-5 mr-2" />
              Choose File
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={handleFileInput}
                disabled={isUploading}
              />
            </label>
            <p className="text-xs text-gray-400 mt-4">
              Supports .xlsx and .xls files up to 10MB
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Upload Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {fileName && !isUploading && !error && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-900">File Ready</p>
            <p className="text-sm text-green-700 mt-1">{fileName}</p>
          </div>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-900 mb-2">Required columns:</p>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <code className="bg-blue-100 px-1 py-0.5 rounded">claim_id</code> - Unique claim identifier</li>
          <li>• <code className="bg-blue-100 px-1 py-0.5 rounded">provider_id</code> - Provider identifier</li>
          <li>• <code className="bg-blue-100 px-1 py-0.5 rounded">service_date</code> - Date of service</li>
          <li>• <code className="bg-blue-100 px-1 py-0.5 rounded">billed_amount</code> - Billed amount</li>
        </ul>
        <p className="text-xs text-blue-600 mt-2">
          Optional: paid_amount, member_id, provider_zip, place_of_service, service_description
        </p>
      </div>
    </div>
  )
}
