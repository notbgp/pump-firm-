'use client';

import { useEffect, useState } from 'react';

interface TradingChartProps {
  tokenAddress: string;
}

export default function TradingChart({ tokenAddress }: TradingChartProps) {
  const [tokenData, setTokenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTokenData() {
      setLoading(true);
      try {
        const response = await fetch(`https://frontend-api.pump.fun/coins/${tokenAddress}`);
        const data = await response.json();
        setTokenData(data);
      } catch (error) {
        console.error('Error fetching token data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (tokenAddress) {
      fetchTokenData();
      const interval = setInterval(fetchTokenData, 10000);
      return () => clearInterval(interval);
    }
  }, [tokenAddress]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">Loading...</div>
          <div className="text-gray-400">Fetching token data</div>
        </div>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">Error</div>
          <div className="text-gray-400">Failed to load token data</div>
        </div>
      </div>
    );
  }

  const priceInSol = tokenData.virtual_sol_reserves && tokenData.virtual_token_reserves
    ? (tokenData.virtual_sol_reserves / tokenData.virtual_token_reserves).toFixed(8)
    : '0';

  const bondingProgress = tokenData.virtual_sol_reserves
    ? ((tokenData.virtual_sol_reserves / 85) * 100).toFixed(1)
    : '0';

  return (
    <div className="h-full bg-gray-900 text-white overflow-y-auto">
      <div className="p-6 border-b border-gray-800 bg-gray-950">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">{tokenData.name || 'Unknown Token'}</h1>
            <p className="text-gray-400 text-sm font-mono">{tokenData.symbol || 'N/A'}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">Market Cap</div>
            <div className="text-xl font-bold text-green-400">
              ${tokenData.usd_market_cap?.toLocaleString() || '0'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-6">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Price (SOL)</div>
          <div className="text-lg font-bold text-cyan-400">{priceInSol}</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Price (USD)</div>
          <div className="text-lg font-bold text-green-400">
            ${tokenData.usd_price?.toFixed(6) || '0'}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Liquidity (SOL)</div>
          <div className="text-lg font-bold text-purple-400">
            {tokenData.virtual_sol_reserves?.toFixed(2) || '0'}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Bonding Progress</div>
          <div className="text-lg font-bold text-yellow-400">{bondingProgress}%</div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-400 mb-3">LIVE CHART</h3>
          <div className="aspect-video bg-gray-900 rounded">
            <iframe
              src={`https://dexscreener.com/solana/${tokenAddress}?embed=1&theme=dark`}
              className="w-full h-full rounded"
              title="Token Chart"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          
            href={`https://pump.fun/${tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-center font-medium transition-colors"
          >
            Pump.fun
          </a>
          
            href={`https://solscan.io/token/${tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-center font-medium transition-colors"
          >
            Solscan
          </a>
        </div>
      </div>

      <div className="p-6 border-t border-gray-800">
        <h3 className="text-sm font-bold text-gray-400 mb-3">TOKEN INFO</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Creator:</span>
            <span className="font-mono text-gray-300">
              {tokenData.creator ? `${tokenData.creator.slice(0, 8)}...${tokenData.creator.slice(-8)}` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Supply:</span>
            <span className="text-gray-300">
              {tokenData.total_supply?.toLocaleString() || 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
