'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Loader2, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const [checking, setChecking] = useState(false);

  const handleRetry = () => {
    setChecking(true);
    // Simulate connection checking
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
      setChecking(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col items-center justify-center p-6 text-center" style={{ background: '#121212' }}>
      <div className="p-8 rounded-2xl max-w-md w-full shadow-2xl flex flex-col items-center gap-6" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
        <div className="bg-red-500/10 p-4 rounded-full text-red-400">
          <WifiOff size={48} />
        </div>
        
        <div>
          <h1 className="text-2xl font-bold mb-2">Connection Unstable</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            KDLGOODS could not reach the server. We are currently checking your connection...
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border rounded-lg text-xs" style={{ background: '#121212', border: '1px solid #2E2E2E', color: '#8A8A8A' }}>
          <Loader2 className="animate-spin" size={14} style={{ color: '#F7D108' }} />
          <span>Status: Checking connection...</span>
        </div>

        <button 
          onClick={handleRetry}
          disabled={checking}
          className="font-semibold py-2.5 px-6 rounded-lg w-full flex items-center justify-center gap-2 transition disabled:opacity-50"
          style={{ background: '#F7D108', color: '#121212' }}
        >
          <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Testing...' : 'Try Again'}
        </button>
      </div>
    </div>
  );
}
