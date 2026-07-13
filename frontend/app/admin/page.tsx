'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import {
  Shield, Users, FileText, Clock, MessageSquare,
  Plus, Check, X, Loader2, Trash2, LogOut,
  BarChart3, ChevronRight, AlertCircle, UserPlus, Download
} from 'lucide-react';

type DashboardStats = {
  total_users: number;
  total_documents: number;
  total_chunks: number;
  pending_requests: number;
  total_sessions: number;
};

type UserItem = {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string | null;
};

type DocumentItem = {
  id: number;
  filename: string;
  title: string;
  min_role: string;
  is_critical: boolean;
  chunk_count: number;
  created_at: string | null;
};

type AccessRequestItem = {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  document_id: number;
  document_title: string;
  reason: string;
  status: string;
  requested_at: string | null;
};

export default function AdminPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'documents' | 'requests'>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [requests, setRequests] = useState<AccessRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Register form state
  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('employee');
  const [regLoading, setRegLoading] = useState(false);
  const [regMessage, setRegMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'folder'>('file');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFolderFiles, setUploadFolderFiles] = useState<File[]>([]);
  const [uploadMinRole, setUploadMinRole] = useState('employee');
  const [uploadIsCritical, setUploadIsCritical] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; currentFileName: string } | null>(null);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'admin') {
        router.push('/chat');
      }
    }
  }, [user, authLoading, router]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, docsRes, reqsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/documents'),
        api.get('/access-requests/pending'),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setDocuments(docsRes.data);
      setRequests(reqsRes.data);
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAll();
    }
  }, [user]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegMessage(null);
    try {
      await api.post('/auth/register', {
        name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
      });
      setRegMessage({ type: 'success', text: `User "${regName}" registered successfully!` });
      setRegName('');
      setRegEmail('');
      setRegPassword('');
      setRegRole('employee');
      fetchAll();
    } catch (err: any) {
      setRegMessage({ type: 'error', text: err.response?.data?.detail || 'Registration failed' });
    } finally {
      setRegLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Delete failed');
    }
  };

  const handleDecision = async (id: number, status: 'approved' | 'denied') => {
    setProcessingId(id);
    try {
      await api.patch(`/access-requests/${id}`, { status });
      setRequests((prev) => prev.filter((r) => r.id !== id));
      if (stats) {
        setStats({ ...stats, pending_requests: stats.pending_requests - 1 });
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to process request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadMessage(null);
    const files = Array.from(e.target.files || []);
    // Filter for .pdf and .docx (case-insensitive)
    const allowed = files.filter(
      (f) => f.name.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().endsWith('.docx')
    );
    setUploadFolderFiles(allowed);
    if (allowed.length === 0 && files.length > 0) {
      setUploadMessage({
        type: 'error',
        text: 'No supported documents (.pdf, .docx) were found in the selected folder.'
      });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadMessage(null);
    setUploadProgress(null);

    if (uploadType === 'file') {
      if (!uploadFile) return;
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('min_role', uploadMinRole);
      formData.append('is_critical', String(uploadIsCritical));
      try {
        const res = await api.post('/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setUploadMessage({ type: 'success', text: res.data.message });
        setUploadFile(null);
        fetchAll();
      } catch (err: any) {
        setUploadMessage({ type: 'error', text: err.response?.data?.detail || 'Upload failed' });
      } finally {
        setUploading(false);
      }
    } else {
      if (uploadFolderFiles.length === 0) return;
      setUploading(true);
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < uploadFolderFiles.length; i++) {
        const currentFile = uploadFolderFiles[i];
        setUploadProgress({
          current: i + 1,
          total: uploadFolderFiles.length,
          currentFileName: currentFile.name
        });

        const formData = new FormData();
        formData.append('file', currentFile);
        formData.append('min_role', uploadMinRole);
        formData.append('is_critical', String(uploadIsCritical));

        try {
          await api.post('/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to upload ${currentFile.name}`, err);
          failCount++;
        }
      }

      setUploading(false);
      setUploadProgress(null);
      setUploadFolderFiles([]);
      fetchAll();

      if (failCount === 0) {
        setUploadMessage({
          type: 'success',
          text: `Successfully processed all ${successCount} documents from folder!`
        });
      } else {
        setUploadMessage({
          type: 'error',
          text: `Processed folder: ${successCount} succeeded, ${failCount} failed.`
        });
      }
    }
  };

  const handleDownloadDocument = async (id: number, filename: string) => {
    try {
      const response = await api.get(`/documents/download/${id}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download document.');
    }
  };

  const handleDeleteDocument = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to completely delete "${title}"? This will remove all database index chunks, embeddings, and the source file.`)) return;
    try {
      await api.delete(`/documents/${id}`);
      fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Delete failed');
    }
  };

  if (authLoading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0c10]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-gray-400 text-sm">Loading Admin Portal...</p>
        </div>
      </div>
    );
  }

  const tabs: { key: 'overview' | 'users' | 'documents' | 'requests'; label: string; icon: any; badge?: number }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'requests', label: 'Requests', icon: Clock, badge: stats?.pending_requests },
  ];

  const roleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500/15 text-red-400 border-red-500/20';
      case 'manager': return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
      default: return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-gray-200 flex">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0f1117] border-r border-gray-800/50 flex flex-col justify-between p-5 shrink-0">
        <div>
          {/* Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">IntelliDocs AI</h1>
              <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest">Admin Panel</p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                    : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </div>
                {tab.badge && tab.badge > 0 ? (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          {/* Quick Actions */}
          <div className="mt-8 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold px-1 mb-2">Quick Actions</p>
            <button
              onClick={() => router.push('/chat')}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-800/40 hover:text-white transition border border-transparent"
            >
              <MessageSquare className="w-4 h-4" />
              Go to Chat
              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />
            </button>
          </div>
        </div>

        {/* User + Logout */}
        <div className="border-t border-gray-800/50 pt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm text-white font-medium truncate">{user.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 text-gray-500 hover:text-red-400 text-sm py-2 transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-white">Dashboard Overview</h2>
                  <p className="text-sm text-gray-500 mt-1">System status and metrics at a glance</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Users', value: stats.total_users, icon: Users, color: 'indigo' },
                    { label: 'Documents', value: stats.total_documents, icon: FileText, color: 'emerald' },
                    { label: 'Indexed Chunks', value: stats.total_chunks, icon: BarChart3, color: 'amber' },
                    { label: 'Pending Requests', value: stats.pending_requests, icon: Clock, color: stats.pending_requests > 0 ? 'red' : 'gray' },
                  ].map((item) => (
                    <div key={item.label} className="glass rounded-2xl p-5 hover:border-gray-600/30 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className={`p-2 rounded-lg bg-${item.color}-500/10`}>
                          <item.icon className={`w-4.5 h-4.5 text-${item.color}-400`} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-white">{item.value.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>

                {/* Recent users */}
                {users.length > 0 && (
                  <div className="glass rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-white mb-4">Recent Users</h3>
                    <div className="space-y-2">
                      {users.slice(0, 5).map((u) => (
                        <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-800/30 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-gray-800 text-gray-400 rounded-full flex items-center justify-center text-[10px] font-bold uppercase">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm text-white font-medium">{u.name}</p>
                              <p className="text-[11px] text-gray-500">{u.email}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${roleColor(u.role)}`}>
                            {u.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">User Management</h2>
                    <p className="text-sm text-gray-500 mt-1">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => { setShowRegister(!showRegister); setRegMessage(null); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20"
                  >
                    <UserPlus className="w-4 h-4" />
                    Register User
                  </button>
                </div>

                {/* Register Form */}
                {showRegister && (
                  <div className="glass rounded-2xl p-6 animate-fade-in">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-indigo-400" />
                      Register New User
                    </h3>
                    <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
                        <input
                          type="text" required value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          className="w-full bg-[#0d0e15] border border-gray-700/50 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
                        <input
                          type="email" required value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="w-full bg-[#0d0e15] border border-gray-700/50 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          placeholder="john@company.com"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
                        <input
                          type="password" required value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="w-full bg-[#0d0e15] border border-gray-700/50 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role</label>
                        <select
                          value={regRole}
                          onChange={(e) => setRegRole(e.target.value)}
                          className="w-full bg-[#0d0e15] border border-gray-700/50 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                        >
                          <option value="employee">Employee</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        {regMessage && (
                          <div className={`p-3 rounded-xl text-sm font-medium mb-3 ${
                            regMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {regMessage.text}
                          </div>
                        )}
                        <button
                          type="submit"
                          disabled={regLoading}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition disabled:opacity-50 flex items-center gap-2"
                        >
                          {regLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          {regLoading ? 'Registering...' : 'Register User'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Users Table */}
                <div className="glass rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800/50">
                        <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">User</th>
                        <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                        <th className="text-right px-5 py-3.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-gray-800/20 hover:bg-gray-800/20 transition">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-800 text-gray-400 rounded-full flex items-center justify-center text-xs font-bold uppercase">
                                {u.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-white font-medium">{u.name}</p>
                                <p className="text-[11px] text-gray-500">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full border ${roleColor(u.role)}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 text-xs">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {u.id !== user.id && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                title="Delete user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Documents</h2>
                    <p className="text-sm text-gray-500 mt-1">{documents.length} indexed document{documents.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowUpload(!showUpload);
                      setUploadMessage(null);
                      setUploadFile(null);
                      setUploadFolderFiles([]);
                      setUploadProgress(null);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    Upload Document
                  </button>
                </div>
 
                {/* Upload Form */}
                {showUpload && (
                  <div className="glass rounded-2xl p-6 animate-fade-in">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      Upload & Index Document
                    </h3>
                    
                    {/* Tab Switcher for Upload Type */}
                    <div className="flex gap-2 mb-4 bg-gray-900/60 p-1 rounded-xl border border-gray-800/60 max-w-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadType('file');
                          setUploadMessage(null);
                          setUploadProgress(null);
                        }}
                        className={`flex-1 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all ${
                          uploadType === 'file'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Single File
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadType('folder');
                          setUploadMessage(null);
                          setUploadProgress(null);
                        }}
                        className={`flex-1 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all ${
                          uploadType === 'folder'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Whole Folder
                      </button>
                    </div>

                    <form onSubmit={handleUpload} className="space-y-4">
                      {uploadType === 'file' ? (
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Select File (.pdf, .docx)</label>
                          <input
                            type="file"
                            accept=".pdf,.docx"
                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                            className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white file:cursor-pointer hover:file:bg-indigo-700 transition"
                            required
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Select Folder</label>
                          <input
                            type="file"
                            // @ts-ignore
                            webkitdirectory=""
                            // @ts-ignore
                            directory=""
                            multiple
                            onChange={handleFolderChange}
                            className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white file:cursor-pointer hover:file:bg-indigo-700 transition"
                            required
                          />
                          {uploadFolderFiles.length > 0 && (
                            <p className="text-xs text-emerald-400 font-medium mt-1.5 flex items-center gap-1.5 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Detected {uploadFolderFiles.length} supported documents (.pdf, .docx) to upload.
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Min Role Access</label>
                          <select
                            value={uploadMinRole}
                            onChange={(e) => setUploadMinRole(e.target.value)}
                            className="w-full bg-[#0d0e15] border border-gray-700/50 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                          >
                            <option value="employee">Employee</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin Only</option>
                          </select>
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={uploadIsCritical}
                              onChange={(e) => setUploadIsCritical(e.target.checked)}
                              className="rounded bg-[#0d0e15] border-gray-700 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-300">Confidential Document</span>
                          </label>
                        </div>
                      </div>

                      {uploadProgress && (
                        <div className="bg-[#0d0e15] border border-gray-800/80 rounded-xl p-4 space-y-2">
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="text-indigo-400">Processing Folder Documents...</span>
                            <span className="text-gray-400">
                              {uploadProgress.current} / {uploadProgress.total} ({Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)
                            </span>
                          </div>
                          
                          <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                            />
                          </div>
                          
                          <p className="text-[11px] text-gray-500 truncate">
                            Current: <span className="text-gray-300 font-mono">{uploadProgress.currentFileName}</span>
                          </p>
                        </div>
                      )}

                      {uploadMessage && (
                        <div className={`p-3 rounded-xl text-sm font-medium ${
                          uploadMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {uploadMessage.text}
                        </div>
                      )}
                      
                      <button
                        type="submit"
                        disabled={uploading || (uploadType === 'file' ? !uploadFile : uploadFolderFiles.length === 0)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition disabled:opacity-50 flex items-center gap-2"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {uploading ? 'Processing...' : 'Upload & Process'}
                      </button>
                    </form>
                  </div>
                )}

                {/* Documents Table */}
                <div className="glass rounded-2xl overflow-hidden">
                  {documents.length === 0 ? (
                    <div className="p-12 text-center">
                      <FileText className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No documents uploaded yet</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800/50">
                          <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                          <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Access</th>
                          <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Chunks</th>
                          <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Uploaded</th>
                          <th className="text-right px-5 py-3.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((doc) => (
                          <tr key={doc.id} className="border-b border-gray-800/20 hover:bg-gray-800/20 transition">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                                <div>
                                  <p className="text-white font-medium">{doc.title}</p>
                                  <p className="text-[11px] text-gray-500">{doc.filename}</p>
                                </div>
                                {doc.is_critical && (
                                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                                    Critical
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${roleColor(doc.min_role)}`}>
                                {doc.min_role}+
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{doc.chunk_count}</td>
                            <td className="px-5 py-3.5 text-gray-500 text-xs">
                              {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-5 py-3.5 text-right flex justify-end gap-1.5">
                              <button
                                onClick={() => handleDownloadDocument(doc.id, doc.filename)}
                                className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition"
                                title="Download document"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc.id, doc.title)}
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                title="Delete document completely"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-white">Access Requests</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {requests.length} pending request{requests.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {requests.length === 0 ? (
                  <div className="glass rounded-2xl p-12 text-center">
                    <Check className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">All caught up! No pending requests.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requests.map((req) => (
                      <div key={req.id} className="glass rounded-2xl p-5 animate-fade-in">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-white font-medium text-sm">{req.user_name}</span>
                              <span className="text-gray-600 text-xs">({req.user_email})</span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-3.5 h-3.5 text-gray-500" />
                              <span className="text-indigo-400 text-sm font-medium">{req.document_title}</span>
                            </div>
                            <p className="text-gray-400 text-sm italic">&ldquo;{req.reason}&rdquo;</p>
                            <p className="text-[11px] text-gray-600 mt-2">
                              {req.requested_at ? new Date(req.requested_at).toLocaleString() : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleDecision(req.id, 'approved')}
                              disabled={processingId === req.id}
                              className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white text-xs font-medium px-3 py-2 rounded-lg border border-emerald-500/20 hover:border-emerald-500 transition disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleDecision(req.id, 'denied')}
                              disabled={processingId === req.id}
                              className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white text-xs font-medium px-3 py-2 rounded-lg border border-red-500/20 hover:border-red-500 transition disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              Deny
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}