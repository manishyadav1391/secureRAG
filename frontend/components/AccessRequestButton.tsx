'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { AlertCircle, CheckCircle, Loader2, FileText } from 'lucide-react';

interface Props {
  documentId: number;
  documentTitle: string;
}

export function AccessRequestButton({ documentId, documentTitle }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [reason, setReason] = useState('');

  const handleRequest = async () => {
    if (!reason.trim()) return alert("Please provide a reason.");
    
    setStatus('loading');
    try {
      await api.post('/access-requests/', {
        document_id: documentId,
        reason: reason
      });
      setStatus('success');
    } catch (error: any) {
      console.error(error);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center text-emerald-400 text-xs font-medium animate-fade-in">
        <CheckCircle className="w-4 h-4 mr-2 shrink-0" />
        Access request sent to admin! You'll be notified via email.
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 bg-red-500/5 border border-red-500/20 rounded-xl animate-fade-in w-full">
      <div className="flex items-start text-red-200 text-xs mb-3">
        <AlertCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5 text-red-400" />
        <p>
          Relevant information exists in restricted document: <strong className="text-white font-semibold">&ldquo;{documentTitle}&rdquo;</strong>. 
          You do not currently have permission to view it.
        </p>
      </div>
      
      <div className="flex gap-2">
        <input 
          type="text" 
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why do you need access?" 
          className="flex-1 bg-[#0d0e15] border border-gray-700/50 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
        />
        <button 
          onClick={handleRequest}
          disabled={status === 'loading'}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center shadow-lg shadow-red-600/10 shrink-0"
        >
          {status === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Request Access'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-red-400 text-[10px] mt-2 font-medium">Failed to send request. You may already have a pending request for this file.</p>
      )}
    </div>
  );
}