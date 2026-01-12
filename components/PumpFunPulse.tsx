'use client';

import { useState, useEffect, useRef } from 'react';

interface NewToken {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: 'create';
  initialBuy: number;
  bondingCurveKey: string;
  vSolInBondingCurve: number;
  marketCapSol: number;
  timestamp?: number;
  name?: string;
  symbol?: string;
}

export default function PumpFunPulse() {
  const [tokens, setTokens] = useState<NewToken[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    totalDetected: 0,
    lastMinute: 0,
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Connect to our Next.js API route that proxies PumpPortal
    const eventSource = new EventSource('/api/pumpfun/stream?subscribe=newToken');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ Connected to new token stream');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const newToken = JSON.parse(event.data) as NewToken;
        
        if (newToken.txType === 'create') {
          newToken.timestamp = Date.now();
          
          setTokens((prev) => [newToken, ...prev].slice(0, 100)); // Keep last 100
          setStats((prev) => ({
            totalDetected: prev.totalDetected + 1,
            lastMinute: prev.lastMinute + 1,
          }));

          // Play sound alert (optional)
          // new Audio('/ding.mp3').play();
          
          console.log('🆕 New token:', newToken.mint);
        }
      } catch (error) {
        console.error('Error parsing event:', error);
      }
    };

    eventSource.onerror = () => {
      console.error('❌ Stream error');
      setIsConnected(false);
    };

    // Reset "last minute" counter every minute
    const interval = setInterval(() => {
      setStats((prev) => ({ ...prev, lastMinute: 0 }));
    }, 60000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, []);

  const getTimeAgo = (timestamp?: number) => {
    if (!timestamp) return 'now';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  const formatSol = (lamports: number) => {
    return (lamports / 1e9).toFixed(4);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header Stats */}
      <div className="p-4 border-b border-gray-800 bg-gray-950">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">🔴 Pump.fun Pulse (Live)</h2>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-gray-400">Total Detected:</span>
            <span className="ml-2 font-mono text-cyan-400">{stats.totalDetected}</span>
          </div>
          <div>
            <span className="text-gray-400">Last Minute:</span>
            <span className="ml-2 font-mono text-green-400">{stats.lastMinute}</span>
          </div>
        </div>
      </div>

      {/* Token Feed */}
      <div className="flex-1 overflow-y-auto">
        {tokens.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Waiting for new tokens...
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {tokens.map((token) => (
              <div
                key={token.signature}
                className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer animate-fadeIn"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Token Info */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-gray-400">
                        {token.mint.slice(0, 8)}...{token.mint.slice(-4)}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(token.mint)}
                        className="text-gray-500 hover:text-white text-xs"
                      >
                        📋
                      </button>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Initial Buy:</span>
                        <span className="ml-1 text-green-400">
                          {formatSol(token.initialBuy)} SOL
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Market Cap:</span>
                        <span className="ml-1 text-cyan-400">
                          {token.marketCapSol.toFixed(2)} SOL
                        </span>
                      </div>
                    </div>

                    {/* Creator */}
                    <div className="text-xs text-gray-500 mt-1">
                      Creator: {token.traderPublicKey.slice(0, 6)}...
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-gray-500">
                      {getTimeAgo(token.timestamp)}
                    </span>
                    <button
                      onClick={() => window.open(`https://pump.fun/${token.mint}`, '_blank')}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
                    >
                      View
                    </button>
                    <button
                      onClick={() => {
                        // Auto-snipe logic here
                        console.log('Sniping:', token.mint);
                      }}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                    >
                      Snipe
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
