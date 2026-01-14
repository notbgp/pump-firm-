'use client';

import { useState } from 'react';
import PumpFunPulseHelius from '@/components/PumpFunPulseHelius';
import TradingChart from '@/components/TradingChart';

export default function TerminalPage() {
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Pump Firm Terminal
          </h1>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-96 border-r border-gray-800">
          <PumpFunPulseHelius 
            onTokenSelect={(mint, token) => {
              setSelectedToken(mint);
              console.log('Selected token:', token);
            }}
          />
        </div>

        <div className="flex-1 overflow-hidden">
          {selectedToken ? (
            <TradingChart tokenAddress={selectedToken} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-6xl mb-4">Chart</div>
                <p className="text-lg">Select a token to view chart</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
