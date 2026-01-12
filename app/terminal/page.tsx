'use client';

import { useState } from 'react';
import PumpFunPulse from '@/components/PumpFunPulse';
import TradingChart from '@/components/TradingChart';

export default function TerminalPage() {
  const [activeTab, setActiveTab] = useState<'pulse' | 'chart' | 'portfolio'>('pulse');

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Top Navigation */}
      <div className="flex gap-2 p-4 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('pulse')}
          className={`px-4 py-2 rounded ${
            activeTab === 'pulse' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          🔴 Pulse
        </button>
        <button
          onClick={() => setActiveTab('chart')}
          className={`px-4 py-2 rounded ${
            activeTab === 'chart' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          📊 Chart
        </button>
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`px-4 py-2 rounded ${
            activeTab === 'portfolio' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          💼 Portfolio
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'pulse' && <PumpFunPulse />}
        {activeTab === 'chart' && <TradingChart />}
        {activeTab === 'portfolio' && <div>Portfolio content</div>}
      </div>
    </div>
  );
}
