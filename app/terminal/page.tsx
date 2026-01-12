'use client';

import { useState } from 'react';
import PumpFunPulse from '@/components/PumpFunPulse';
import TradingChart from '@/components/TradingChart';
import PositionManager from '@/components/PositionManager';
import WalletButton from '@/components/WalletButton';

export default function AxiomClonePage() {
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">🚀 Your Trading Terminal</h1>
          <span className="text-xs text-gray-500">Powered by PumpPortal</span>
        </div>
        
        <div className="flex items-center gap-4">
          <WalletButton />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Token Discovery */}
        <div className="w-80 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-sm font-bold text-gray-400 uppercase">Discover</h2>
          </div>
          <PumpFunPulse />
        </div>

        {/* Center - Chart */}
        <div className="flex-1 flex flex-col">
          {selectedToken ? (
            <>
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-gray-400">
                    {selectedToken.slice(0, 8)}...{selectedToken.slice(-4)}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(selectedToken)}
                    className="text-gray-500 hover:text-white text-xs"
                  >
                    📋
                  </button>
                </div>
              </div>
              <TradingChart tokenAddress={selectedToken} />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a token to view chart
            </div>
          )}
        </div>

        {/* Right Sidebar - Positions */}
        <div className="w-80 border-l border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-sm font-bold text-gray-400 uppercase">Positions</h2>
          </div>
          <PositionManager />
        </div>
      </div>
    </div>
  );
}
