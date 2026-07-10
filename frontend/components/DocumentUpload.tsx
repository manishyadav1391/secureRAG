'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export function DocumentUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [minRole, setMinRole] = useState('employee');
  const [isCritical, setIsCritical] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('loading');
    
    // We must use FormData to send files via POST
    const formData = new FormData();
    formData.append('file', file);
    formData.append('min_role', minRole);
    formData.append('is_critical', String(isCritical));

    try {
      const response = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      setStatus('success');
      setMessage(response.data.message);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      setStatus('error');
      setMessage(error.response?.data?.detail || 'Upload failed.');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <Upload className="w-5 h-5 mr-2 text-blue-600" />
        Upload New Document
      </h2>

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select File (PDF or DOCX)</label>
          <input
            type="file"
            accept=".pdf,.docx"
            ref={fileInputRef}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Role Required</label>
            <select
              value={minRole}
              onChange={(e) => setMinRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 text-black"
            >
              <option value="employee">Employee (Everyone)</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin Only</option>
            </select>
          </div>

          <div className="flex items-center mt-6">
            <input
              type="checkbox"
              id="is_critical"
              checked={isCritical}
              onChange={(e) => setIsCritical(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_critical" className="ml-2 block text-sm text-gray-700">
              Mark as Confidential Document
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={!file || status === 'loading'}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Process & Ingest Document'}
        </button>
      </form>

      {status === 'success' && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded flex items-start text-sm">
          <CheckCircle className="w-5 h-5 mr-2 shrink-0" /> {message}
        </div>
      )}
      {status === 'error' && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded flex items-start text-sm">
          <AlertCircle className="w-5 h-5 mr-2 shrink-0" /> {message}
        </div>
      )}
    </div>
  );
}