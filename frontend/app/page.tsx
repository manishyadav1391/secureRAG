'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Shield } from 'lucide-react';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/chat');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0c10]">
      <div className="flex flex-col items-center gap-5 animate-fade-in">
        <div className="p-4 bg-indigo-600/20 rounded-2xl animate-pulse-glow">
          <Shield className="w-10 h-10 text-indigo-400" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">SecurRAG</h1>
          <p className="text-sm text-gray-500 mt-1">Loading your workspace...</p>
        </div>
        <div className="flex gap-1.5">
          <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce" />
          <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.15s]" />
          <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.3s]" />
        </div>
      </div>
    </div>
  );
}
