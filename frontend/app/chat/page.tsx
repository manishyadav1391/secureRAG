'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import {
  Send, Bot, User, LogOut, Plus, MessageSquare, Shield,
  Trash2, ChevronDown, ChevronUp, FileText, Loader2, Settings
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AccessRequestButton } from '@/components/AccessRequestButton';

type SourceChunk = {
  doc_title: string;
  page_number: number | null;
  content_preview: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestedQuestions?: string[];
  restrictedReference?: {
    document_id: number;
    title: string;
  } | null;
  source_chunks?: SourceChunk[];
};

type ChatSession = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

export default function ChatPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [provider, setProvider] = useState('ollama');
  const [modelName, setModelName] = useState('gpt-oss:120b');
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    if (newProvider === 'gemini') setModelName('gemini-1.5-flash');
    else if (newProvider === 'openai') setModelName('gpt-4o-mini');
    else if (newProvider === 'anthropic') setModelName('claude-3-5-haiku-20241022');
    else if (newProvider === 'ollama') setModelName('gpt-oss:120b');
  };

  // Auth redirect
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Scroll to bottom on message change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Load sessions on mount
  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/chat/sessions');
      setSessions(res.data);
    } catch (err) {
      console.error('Failed to load sessions', err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSessions();
    }
  }, [user, fetchSessions]);

  // Load a specific session's messages
  const loadSession = async (sessionId: number) => {
    setActiveSessionId(sessionId);
    setExpandedSources(new Set());
    try {
      const res = await api.get(`/chat/sessions/${sessionId}`);
      const loadedMessages: Message[] = res.data.messages.map((m: any) => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        source_chunks: m.source_chunks || [],
      }));
      setMessages(loadedMessages);
    } catch (err) {
      console.error('Failed to load session', err);
    }
  };

  // Start new chat
  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setExpandedSources(new Set());
    inputRef.current?.focus();
  };

  // Delete session
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  };

  // Toggle source chunks visibility
  const toggleSources = (msgId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  // Send message
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isSending) return;

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsSending(true);

    try {
      const response = await api.post('/chat/message', {
        message: text,
        session_id: activeSessionId,
        provider: provider,
        model_name: modelName,
      });

      // If this was a new chat, capture the session_id
      if (!activeSessionId && response.data.session_id) {
        setActiveSessionId(response.data.session_id);
      }

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: response.data.answer,
        suggestedQuestions: response.data.suggested_questions || [],
        restrictedReference: response.data.restricted_reference,
        source_chunks: response.data.source_chunks || [],
      };

      setMessages((prev) => [...prev, botMsg]);

      // Refresh sessions list
      fetchSessions();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err.response?.data?.detail || err.message}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0c10]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-gray-400 text-sm">Loading your secure workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#0b0c10] text-gray-200 overflow-hidden">
      {/* ===== SIDEBAR ===== */}
      <aside className="w-72 bg-[#0f1117] border-r border-gray-800/50 flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-800/50 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">IntelliDocs AI</h1>
              <p className="text-[9px] text-indigo-400 font-semibold uppercase tracking-widest">Knowledge Base</p>
            </div>
          </div>

          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Chat Sessions List — Independent Scroll */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="text-[9px] text-gray-600 uppercase tracking-widest font-semibold px-2 mb-2">
            Chat History
          </p>

          {sessionsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-6 h-6 text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-600">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm ${
                    activeSessionId === session.id
                      ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/20'
                      : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200 border border-transparent'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium">{session.title}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {session.message_count} message{session.message_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 rounded transition"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-800/50 shrink-0">
          {/* User */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm text-white font-medium truncate">{user.name}</p>
              <p className="text-[10px] text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {user.role === 'admin' && (
              <button
                onClick={() => router.push('/admin')}
                className="flex-1 text-xs text-gray-400 hover:text-indigo-400 py-1.5 rounded-lg hover:bg-gray-800/50 transition flex items-center justify-center gap-1"
              >
                <Settings className="w-3.5 h-3.5" />
                Admin
              </button>
            )}
            <button
              onClick={logout}
              className="flex-1 text-xs text-gray-400 hover:text-red-400 py-1.5 rounded-lg hover:bg-gray-800/50 transition flex items-center justify-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* ===== MAIN CHAT AREA ===== */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 border-b border-gray-800/50 bg-[#0d0e15] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">
              {activeSessionId
                ? sessions.find((s) => s.id === activeSessionId)?.title || 'Chat'
                : 'New Conversation'}
            </span>
          </div>

          {/* Provider & Model Selector */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition"
            >
              <Settings className="w-3.5 h-3.5" />
              {provider} / {modelName}
            </button>
          </div>
        </header>

        {/* Settings Panel (collapsible) */}
        {showSettings && (
          <div className="border-b border-gray-800/50 bg-[#0f1117] px-6 py-3 flex items-center gap-4 animate-fade-in shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Provider</span>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="bg-[#0d0e15] border border-gray-700/50 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ollama">Ollama</option>
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Model</span>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="bg-[#0d0e15] border border-gray-700/50 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
              />
            </div>
          </div>
        )}

        {/* Messages Area — Only this scrolls */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in">
              <div className="p-4 bg-gray-800/30 rounded-2xl mb-4">
                <Bot className="w-8 h-8 text-indigo-400/40" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Start a Conversation</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Ask questions about company documents, policies, and procedures. 
                I&apos;ll search through your authorized documents to find answers.
              </p>
              <div className="flex flex-wrap gap-2 mt-6 max-w-lg justify-center">
                {[
                  'What are our HR policies?',
                  'Summarize the Q4 report',
                  'What is the leave policy?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSendMessage(q)}
                    className="text-xs bg-gray-800/40 hover:bg-indigo-600/15 text-gray-400 hover:text-indigo-300 border border-gray-700/30 hover:border-indigo-500/30 rounded-full px-4 py-2 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 animate-fade-in ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* Avatar (bot only on left) */}
                  {msg.role === 'assistant' && (
                    <div className="p-2 rounded-xl h-8 w-8 bg-gray-800 text-indigo-400 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {/* Message Bubble */}
                    <div
                      className={`rounded-2xl py-3 px-4 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-sm'
                          : 'bg-[#1a1d27] text-gray-200 rounded-tl-sm border border-gray-800/50'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-invert prose-sm max-w-none
                          [&_p]:my-1.5 [&_p]:leading-relaxed
                          [&_strong]:text-white [&_strong]:font-semibold
                          [&_em]:text-indigo-300
                          [&_ol]:my-2 [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:list-decimal
                          [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:list-disc
                          [&_li]:text-gray-200 [&_li]:leading-relaxed
                          [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-3 [&_h1]:mb-2
                          [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-3 [&_h2]:mb-1.5
                          [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mt-2 [&_h3]:mb-1
                          [&_code]:bg-gray-800 [&_code]:text-indigo-300 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                          [&_pre]:bg-gray-900 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto
                          [&_pre_code]:bg-transparent [&_pre_code]:p-0
                          [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-500/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-400
                          [&_a]:text-indigo-400 [&_a]:underline [&_a]:underline-offset-2
                          [&_hr]:border-gray-700/50 [&_hr]:my-3
                          [&_table]:w-full [&_table]:my-2
                          [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-gray-400 [&_th]:pb-2 [&_th]:border-b [&_th]:border-gray-700/50
                          [&_td]:text-sm [&_td]:py-1.5 [&_td]:border-b [&_td]:border-gray-800/30
                        ">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>

                    {/* Source Chunks (bot messages only) */}
                    {msg.role === 'assistant' && msg.source_chunks && msg.source_chunks.length > 0 && (
                      <div className="mt-2 w-full">
                        <button
                          onClick={() => toggleSources(msg.id)}
                          className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-indigo-400 transition font-medium"
                        >
                          <FileText className="w-3 h-3" />
                          {msg.source_chunks.length} source{msg.source_chunks.length !== 1 ? 's' : ''} referenced
                          {expandedSources.has(msg.id) ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>

                        {expandedSources.has(msg.id) && (
                          <div className="mt-2 space-y-1.5 animate-fade-in">
                            {msg.source_chunks.map((chunk, idx) => (
                              <div
                                key={idx}
                                className="bg-[#13151c] border border-gray-800/40 rounded-xl p-3 text-xs"
                              >
                                <div className="flex items-center gap-2 mb-1.5">
                                  <FileText className="w-3 h-3 text-indigo-400" />
                                  <span className="text-indigo-300 font-medium">{chunk.doc_title}</span>
                                  {chunk.page_number && (
                                    <span className="text-gray-600 text-[10px]">
                                      Page {chunk.page_number}
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-500 leading-relaxed">{chunk.content_preview}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Restricted Document Warning & Request Action */}
                    {msg.restrictedReference && (
                      <AccessRequestButton 
                        documentId={msg.restrictedReference.document_id} 
                        documentTitle={msg.restrictedReference.title} 
                      />
                    )}

                    {/* Suggested Questions */}
                    {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.suggestedQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(q)}
                            className="text-[11px] bg-gray-800/30 hover:bg-indigo-600/15 text-gray-400 hover:text-indigo-300 border border-gray-700/30 hover:border-indigo-500/30 rounded-full px-3 py-1.5 transition"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Avatar (user on right) */}
                  {msg.role === 'user' && (
                    <div className="p-2 rounded-xl h-8 w-8 bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing Indicator */}
              {isSending && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="p-2 rounded-xl h-8 w-8 bg-gray-800 text-indigo-400 flex items-center justify-center shrink-0 animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-[#1a1d27] rounded-2xl rounded-tl-sm border border-gray-800/50 py-3 px-5 flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce" />
                    <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar — Fixed at bottom */}
        <div className="p-4 bg-[#0d0e15]/80 backdrop-blur-md border-t border-gray-800/50 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputValue);
            }}
            className="max-w-3xl mx-auto flex gap-2.5 bg-[#1a1d27] border border-gray-800/50 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500/30 transition-all"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask anything about company documents..."
              className="flex-1 bg-transparent px-3.5 py-2.5 text-white placeholder-gray-600 focus:outline-none text-sm"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !inputValue.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg p-2.5 transition disabled:opacity-30 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-center text-[10px] text-gray-700 mt-2">
            IntelliDocs AI uses RAG to answer from your authorized documents only
          </p>
        </div>
      </main>
    </div>
  );
}
