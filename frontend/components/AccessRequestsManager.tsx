'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Check, X, Loader2, Clock } from 'lucide-react';

type AccessRequest = {
  id: number;
  user_id: number;
  document_id: number;
  reason: string;
  requested_at: string;
};

export function AccessRequestsManager() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/access-requests/pending');
      setRequests(response.data);
    } catch (error) {
      console.error("Failed to fetch requests", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleDecision = async (id: number, status: 'approved' | 'denied') => {
    setProcessingId(id);
    try {
      await api.patch(`/access-requests/${id}`, { status });
      // Remove the processed request from the list
      setRequests((prev) => prev.filter((req) => req.id !== id));
    } catch (error) {
      alert("Failed to process request.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <Clock className="w-5 h-5 mr-2 text-orange-500" />
        Pending Access Requests
      </h2>

      {requests.length === 0 ? (
        <p className="text-sm text-gray-500">No pending access requests.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="p-4 border border-gray-100 bg-gray-50 rounded-lg flex flex-col md:flex-row justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  User ID: {req.user_id} requested Document ID: {req.document_id}
                </p>
                <p className="text-sm text-gray-600 mt-1"><span className="font-semibold">Reason:</span> {req.reason}</p>
                <p className="text-xs text-gray-400 mt-2">Requested: {new Date(req.requested_at).toLocaleString()}</p>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDecision(req.id, 'approved')}
                  disabled={processingId === req.id}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 flex items-center disabled:opacity-50"
                >
                  <Check className="w-4 h-4 mr-1" /> Approve
                </button>
                <button
                  onClick={() => handleDecision(req.id, 'denied')}
                  disabled={processingId === req.id}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 flex items-center disabled:opacity-50"
                >
                  <X className="w-4 h-4 mr-1" /> Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}