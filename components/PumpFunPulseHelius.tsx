'use client';

import { useState, useEffect, useRef } from 'react';

interface NewToken {
  signature: string;
  mint: string;
  creator: string;
  slot: number;
  timestamp: number;
}

interface Props {
  onTokenSelect?: (mint: string, token: NewToken) => void;
}

export default function PumpFunPulseHelius({ onTokenSelect }: Props) {
  const [tokens, setTokens] = useState<NewToken[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    lastMinute: 0,
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const eventSource = new EventSource('/api/helius/grpc-stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ EventSource opened');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('✅ Connected to Helius');
          setIsConnected(true);
          return;
        }

        if (data.type === 'error') {
          console.error('❌ Error:', data.message);
          setIsConnected(false);
          return;
        }

        if (data.type === 'newToken') {
          const newToken: NewToken = {
            signature: data.signature,
            mint: data.mint,
            creator: data.creator,
            slot: data.slot,
            timestamp: data.timestamp,
          };

          setTokens((prev) => [newToken, ...prev].slice(0, 100));
          setStats((prev) => ({
            total: prev.total + 1,
            lastMinute: prev.lastMinute + 1,
          }));

          console.log('🆕 New token:', newToken.mint);
        }
      } catch (error) {
        console.error('Error parsing event:', error);
      }
    };

    eventSource.onerror = () => {
      console.error('❌ Connection error');
      setIsConnected(false);
    };

    const interval = setInterval(() => {
      setStats((prev) => ({ ...prev, lastMinute: 0 }));
    }, 60000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, []);

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h`;
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-800 bg-gray-950">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            ⚡ New Tokens (Helius)
          </h2>
          
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-gray-400 text-xs">Total</div>
            <div className="font-mono text-lg text-cyan-400">{stats.total}</div>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-gray-400 text-xs">Last Min</div>
            <div className="font-mono text-lg text-green-400">{stats.lastMinute}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-4xl mb-2">👀</div>
            <div className="text-sm">Waiting for new tokens...</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {tokens.map((token) => (
              <div
                key={token.signature}
                onClick={() => onTokenSelect?.(token.mint, token)}
                className="p-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs text-gray-400">
                        {token.mint.slice(0, 8)}...{token.mint.slice(-4)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(token.mint);
                        }}
                        className="text-gray-500 hover:text-white text-xs"
                      >
                        📋
                      </button>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-gray-500">Slot: </span>
                        <span className="text-blue-400 font-mono text-xs">
                          {token.slot.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Creator: </span>
                        <span className="text-purple-400 font-mono text-xs">
                          {token.creator.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    <span className="text-xs text-gray-500">
                      {getTimeAgo(token.timestamp)}
                    </span>
                    
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://pump.fun/${token.mint}`, '_blank');
                        }}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-xs transition-colors"
                      >
                        View
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://solscan.io/tx/${token.signature}`, '_blank');
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
                      >
                        TX
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
