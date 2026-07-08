'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { AccessRequestButton } from './AccessRequestButton';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestedQuestions?: string[];
  restrictedReference?: { document_id: number; title: string } | null;
};

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState('gemini');
  const [modelName, setModelName] = useState('gemini-1.5-flash');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    if (newProvider === 'gemini') setModelName('gemini-1.5-flash');
    else if (newProvider === 'openai') setModelName('gpt-4o-mini');
    else if (newProvider === 'anthropic') setModelName('claude-3-5-haiku-20241022');
    else if (newProvider === 'ollama') setModelName('gpt-oss:120b');
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/chat/message', { 
        message: text,
        provider: provider,
        model_name: modelName
      });
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.answer,
        suggestedQuestions: response.data.suggested_questions,
        restrictedReference: response.data.restricted_reference,
      };
      
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: "Sorry, I encountered an error processing your request." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Provider Selector Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between gap-4 text-sm text-gray-700">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">AI Assistant</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-medium">Provider:</span>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2.5 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
            >
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-medium">Model:</span>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="bg-white border border-gray-300 rounded px-2.5 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium w-36"
              placeholder="Model Name"
            />
          </div>
        </div>
      </div>
      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Hello! Ask me anything about our company documents.</p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              
              {/* Avatar */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-blue-600 ml-3' : 'bg-gray-800 mr-3'}`}>
                {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
              </div>

              {/* Content Bubble */}
              <div className="flex flex-col">
                <div className={`p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none whitespace-pre-wrap'}`}>
                  {msg.content}
                </div>

                {/* Restricted Document Prompt */}
                {msg.restrictedReference && (
                  <AccessRequestButton 
                    documentId={msg.restrictedReference.document_id} 
                    documentTitle={msg.restrictedReference.title} 
                  />
                )}

                {/* Suggested Questions (only show on the latest bot message) */}
                {msg.suggestedQuestions && index === messages.length - 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q)}
                        className="px-3 py-1.5 text-xs bg-white border border-blue-200 text-blue-700 rounded-full hover:bg-blue-50 transition-colors text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-center text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> AI is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-100 bg-gray-50">
        <form 
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center min-w-[3rem]"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}