'use client';

interface TradingChartProps {
  tokenAddress: string;
}

export default function TradingChart({ tokenAddress }: TradingChartProps) {
  return (
    <div className="h-full bg-gray-900 text-white p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Token Chart</h1>
        <p className="text-gray-400 text-sm font-mono">{tokenAddress}</p>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-bold text-gray-400 mb-3">LIVE CHART</h3>
        <div style={{ width: '100%', height: '500px' }}>
          <iframe
            src={'https://dexscreener.com/solana/' + tokenAddress + '?embed=1&theme=dark'}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
            title="Token Chart"
          ></iframe>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        
          href={'https://pump.fun/' + tokenAddress}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-center font-medium"
        >
          View on Pump.fun
        </a>
        
          href={'https://solscan.io/token/' + tokenAddress}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-center font-medium"
        >
          View on Solscan
        </a>
      </div>
    </div>
  );
}
