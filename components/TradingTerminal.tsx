'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';
import { useEffect, useState } from 'react';

interface PumpCoin {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  market_cap: number;
  created_timestamp: number;
  raydium_pool?: string;
  complete?: boolean;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
}

interface Challenge {
  id: number;
  name: string;
  requiredProfit: number;
  maxDrawdown: number;
  accountSize: number;
  profitSplit: number;
  locked: boolean;
}

const CHALLENGES: Challenge[] = [
  { id: 1, name: 'Demo Challenge', requiredProfit: 0, maxDrawdown: 0, accountSize: 0, profitSplit: 0, locked: false },
  { id: 2, name: 'Phase 1', requiredProfit: 20, maxDrawdown: 10, accountSize: 100, profitSplit: 50, locked: true },
  { id: 3, name: 'Phase 2', requiredProfit: 15, maxDrawdown: 8, accountSize: 500, profitSplit: 70, locked: true },
  { id: 4, name: 'Funded Trader', requiredProfit: 10, maxDrawdown: 12, accountSize: 5000, profitSplit: 80, locked: true },
];

export default function TradingTerminal() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [selectedCoin, setSelectedCoin] = useState<PumpCoin | null>(null);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  
  // Pump.fun state
  const [pumpCoins, setPumpCoins] = useState<PumpCoin[]>([]);
  const [activeTab, setActiveTab] = useState<'new' | 'graduating' | 'graduated'>('new');
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  
  // Challenge state
  const [currentChallenge, setCurrentChallenge] = useState(CHALLENGES[0]);
  const [challengeStats, setChallengeStats] = useState({
    startBalance: 0,
    currentBalance: 0,
    totalPnL: 0,
    maxDrawdown: 0,
    trades: 0,
    winRate: 0
  });

  useEffect(() => {
    if (publicKey) {
      connection.getBalance(publicKey).then((bal) => {
        setBalance(bal / LAMPORTS_PER_SOL);
      });
    }
  }, [publicKey, connection]);

  // Fetch Pump.fun data
  useEffect(() => {
    const fetchPumpCoins = async () => {
      try {
        const response = await fetch('/api/pumpfun');
        const data = await response.json();
        setPumpCoins(data || []);
      } catch (error) {
        console.error('Failed to fetch Pump.fun coins:', error);
      }
    };

    fetchPumpCoins();
    const interval = setInterval(fetchPumpCoins, 10000);
    return () => clearInterval(interval);
  }, []);

  const getQuote = async () => {
    if (!amount || parseFloat(amount) <= 0 || !selectedCoin) return;
    
    setLoading(true);
    setStatus('Getting quote...');
    
    try {
      const solMint = 'So11111111111111111111111111111111111111112';
      const inputMint = tradeMode === 'buy' ? solMint : selectedCoin.mint;
      const outputMint = tradeMode === 'buy' ? selectedCoin.mint : solMint;
      const amountLamports = Math.floor(parseFloat(amount) * 1e9);
      
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint,
          outputMint,
          amount: amountLamports,
        }),
      });

      const data = await response.json();
      setQuote(data);
      const outputAmount = tradeMode === 'buy' 
        ? (data.outAmount / 1e6).toFixed(2)
        : (data.outAmount / 1e9).toFixed(4);
      setStatus(`Quote: ${outputAmount} ${tradeMode === 'buy' ? selectedCoin.symbol : 'SOL'}`);
    } catch (error) {
      setStatus('Error getting quote');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!publicKey || !signTransaction || !quote) return;

    setLoading(true);
    setStatus('Executing swap...');

    try {
      const response = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPublicKey: publicKey.toString(),
          quoteResponse: quote,
        }),
      });

      const { swapTransaction } = await response.json();
      
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      const signedTransaction = await signTransaction(transaction);
      
      const rawTransaction = signedTransaction.serialize();
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });

      await connection.confirmTransaction(txid);
      
      setStatus(`Success! TX: ${txid.slice(0, 8)}...`);
      setQuote(null);
      setAmount('');
      
      const newBalance = await connection.getBalance(publicKey);
      setBalance(newBalance / LAMPORTS_PER_SOL);
      
      // Update challenge stats
      setChallengeStats(prev => ({
        ...prev,
        trades: prev.trades + 1
      }));
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getBondingProgress = (coin: PumpCoin) => {
    const GRADUATION_THRESHOLD = 85;
    const currentSOL = coin.virtual_sol_reserves / 1e9;
    return Math.min((currentSOL / GRADUATION_THRESHOLD) * 100, 100);
  };

  const getFilteredCoins = () => {
    if (activeTab === 'new') {
      return pumpCoins.filter(c => !c.complete).slice(0, 20);
    } else if (activeTab === 'graduating') {
      return pumpCoins.filter(c => !c.complete && getBondingProgress(c) > 70).slice(0, 20);
    } else {
      return pumpCoins.filter(c => c.complete).slice(0, 20);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const formatMarketCap = (mc: number) => {
    if (mc >= 1000000) return `$${(mc / 1000000).toFixed(1)}M`;
    if (mc >= 1000) return `$${(mc / 1000).toFixed(0)}K`;
    return `$${mc.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Top Nav - Axiom Style */}
      <div className="border-b border-gray-800 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center font-bold">
                PF
              </div>
              <h1 className="text-xl font-bold">Pump Firm</h1>
            </div>
            <nav className="flex gap-1">
              <button className="px-4 py-1.5 bg-purple-600/20 text-purple-400 rounded-lg text-sm font-medium">
                Trade
              </button>
              <button className="px-4 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg text-sm font-medium">
                Portfolio
              </button>
              <button className="px-4 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg text-sm font-medium">
                Leaderboard
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {publicKey && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded-lg border border-gray-800">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">{balance.toFixed(2)} SOL</span>
              </div>
            )}
            <WalletMultiButton />
          </div>
        </div>
      </div>

      {/* Main Grid - Axiom Layout */}
      <div className="grid grid-cols-12 gap-3 p-3 h-[calc(100vh-65px)]">
        
        {/* LEFT - Token Feed */}
        <div className="col-span-3 flex flex-col gap-3 overflow-hidden">
          {/* Tabs */}
          <div className="bg-[#111] rounded-xl border border-gray-800 overflow-hidden">
            <div className="grid grid-cols-3 bg-black/50">
              <button
                onClick={() => setActiveTab('new')}
                className={`py-2.5 text-xs font-bold transition-all ${
                  activeTab === 'new' 
                    ? 'bg-gradient-to-b from-purple-600 to-purple-700 text-white' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                NEW
              </button>
              <button
                onClick={() => setActiveTab('graduating')}
                className={`py-2.5 text-xs font-bold transition-all ${
                  activeTab === 'graduating' 
                    ? 'bg-gradient-to-b from-yellow-600 to-yellow-700 text-white' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                GRADUATING
              </button>
              <button
                onClick={() => setActiveTab('graduated')}
                className={`py-2.5 text-xs font-bold transition-all ${
                  activeTab === 'graduated' 
                    ? 'bg-gradient-to-b from-green-600 to-green-700 text-white' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                GRADUATED
              </button>
            </div>
          </div>

          {/* Token List */}
          <div className="flex-1 bg-[#111] rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-y-auto h-full custom-scrollbar">
              {getFilteredCoins().map((coin) => (
                <button
                  key={coin.mint}
                  onClick={() => setSelectedCoin(coin)}
                  className={`w-full p-3 border-b border-gray-800/50 hover:bg-gray-900/50 transition-all ${
                    selectedCoin?.mint === coin.mint ? 'bg-purple-900/20 border-l-2 border-l-purple-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <img 
                      src={coin.image_uri} 
                      alt={coin.name}
                      className="w-10 h-10 rounded-lg bg-gray-800 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23374151" width="100" height="100"/%3E%3C/svg%3E';
                      }}
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm truncate">{coin.symbol}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">{formatTimeAgo(coin.created_timestamp)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 truncate">{coin.name}</span>
                        <span className="text-xs font-bold text-green-400 flex-shrink-0">{formatMarketCap(coin.market_cap)}</span>
                      </div>
                      {!coin.complete && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Progress</span>
                            <span className={`font-bold ${getBondingProgress(coin) > 90 ? 'text-yellow-400' : 'text-purple-400'}`}>
                              {getBondingProgress(coin).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full transition-all ${
                                getBondingProgress(coin) > 90 
                                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500' 
                                  : 'bg-gradient-to-r from-purple-500 to-pink-500'
                              }`}
                              style={{width: `${getBondingProgress(coin)}%`}}
                            ></div>
                          </div>
                        </div>
                      )}
                      {coin.complete && (
                        <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400 font-medium">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Raydium
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER - Chart */}
        <div className="col-span-6 bg-[#111] rounded-xl border border-gray-800 flex flex-col">
          {selectedCoin ? (
            <>
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={selectedCoin.image_uri} alt={selectedCoin.name} className="w-12 h-12 rounded-lg" />
                    <div>
                      <h2 className="text-2xl font-bold">{selectedCoin.symbol}</h2>
                      <p className="text-sm text-gray-400">{selectedCoin.name}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {['5m', '15m', '1h', '4h', '1d'].map(tf => (
                      <button key={tf} className="px-3 py-1 text-xs bg-gray-900 hover:bg-gray-800 rounded font-medium">
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-1 bg-[#0a0a0a] flex items-center justify-center">
                <div className="text-center text-gray-600">
                  <svg className="w-20 h-20 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  <p className="text-sm font-medium">TradingView Chart</p>
                  <p className="text-xs mt-1">Coming Soon</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-600">
                <svg className="w-20 h-20 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <p className="text-sm font-medium">Select a token to view chart</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT - Trade + Challenge */}
        <div className="col-span-3 flex flex-col gap-3 overflow-y-auto">
          {/* Challenge Status */}
          <div className="bg-[#111] rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Prop Challenge</h3>
              <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded font-bold">
                {currentChallenge.name}
              </span>
            </div>
            
            {currentChallenge.id === 1 ? (
              <div className="space-y-3">
                <div className="text-center py-4">
                  <div className="text-3xl font-bold mb-1">Demo Mode</div>
                  <p className="text-xs text-gray-400">Practice trading risk-free</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-gray-900/50 rounded-lg p-2">
                    <div className="text-xs text-gray-500">Trades</div>
                    <div className="text-lg font-bold">{challengeStats.trades}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-2">
                    <div className="text-xs text-gray-500">Win Rate</div>
                    <div className="text-lg font-bold">{challengeStats.winRate}%</div>
                  </div>
                </div>
                <button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-2.5 rounded-lg text-sm font-bold">
                  Start Phase 1 Challenge
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Target Profit</div>
                    <div className="text-lg font-bold text-green-400">+{currentChallenge.requiredProfit}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Max DD</div>
                    <div className="text-lg font-bold text-red-400">-{currentChallenge.maxDrawdown}%</div>
                  </div>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-2">
                  <div className="text-xs text-gray-500 mb-1">Progress</div>
                  <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full" style={{width: '0%'}}></div>
                  </div>
                  <div className="text-xs text-right text-gray-400">0%</div>
                </div>
              </div>
            )}
          </div>

          {/* Trade Panel */}
          <div className="bg-[#111] rounded-xl border border-gray-800 p-4 flex-1">
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setTradeMode('buy')}
                className={`py-2 rounded-lg text-sm font-bold transition-all ${
                  tradeMode === 'buy' 
                    ? 'bg-gradient-to-b from-green-600 to-green-700 text-white' 
                    : 'bg-gray-900 text-gray-400 hover:text-white'
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setTradeMode('sell')}
                className={`py-2 rounded-lg text-sm font-bold transition-all ${
                  tradeMode === 'sell' 
                    ? 'bg-gradient-to-b from-red-600 to-red-700 text-white' 
                    : 'bg-gray-900 text-gray-400 hover:text-white'
                }`}
              >
                SELL
              </button>
            </div>

            {selectedCoin ? (
              <>
                <div className="mb-3">
                  <label className="text-xs text-gray-500 mb-2 block uppercase font-bold">
                    {tradeMode === 'buy' ? 'You Pay' : 'You Sell'}
                  </label>
                  <div className="bg-black/50 border border-gray-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold">{tradeMode === 'buy' ? 'SOL' : selectedCoin.symbol}</span>
                      {publicKey && (
                        <span className="text-xs text-gray-500">
                          Bal: {balance.toFixed(4)}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setQuote(null);
                      }}
                      placeholder="0.00"
                      disabled={!publicKey}
                      className="w-full bg-transparent text-2xl font-bold outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="flex justify-center my-3">
                  <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-gray-500 mb-2 block uppercase font-bold">
                    {tradeMode === 'buy' ? 'You Receive' : 'You Get'}
                  </label>
                  <div className="bg-black/50 border border-gray-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold">{tradeMode === 'buy' ? selectedCoin.symbol : 'SOL'}</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-400">
                      {quote ? (
                        tradeMode === 'buy' 
                          ? (quote.outAmount / 1e6).toFixed(2)
                          : (quote.outAmount / 1e9).toFixed(4)
                      ) : '0.00'}
                    </div>
                  </div>
                </div>

                {!publicKey ? (
                  <button disabled className="w-full bg-gray-800 py-3 rounded-lg font-bold cursor-not-allowed">
                    CONNECT WALLET
                  </button>
                ) : !quote ? (
                  <button
                    onClick={getQuote}
                    disabled={loading || !amount || parseFloat(amount) <= 0}
                    className={`w-full py-3 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      tradeMode === 'buy'
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                        : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
                    }`}
                  >
                    {loading ? 'LOADING...' : 'GET QUOTE'}
                  </button>
                ) : (
                  <button
                    onClick={executeSwap}
                    disabled={loading}
                    className={`w-full py-3 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      tradeMode === 'buy'
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                        : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
                    }`}
                  >
                    {loading ? 'EXECUTING...' : `${tradeMode === 'buy' ? 'BUY' : 'SELL'} ${selectedCoin.symbol}`}
                  </button>
                )}

                {status && (
                  <div className="mt-3 p-2 bg-gray-900/50 border border-gray-800 rounded text-xs text-center text-gray-400">
                    {status}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-600">
                <p className="text-sm">Select a token from the list to trade</p>
              </div>
            )}
          </div>
        </div   
</div>
      <style jsx>{`
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #111;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #333;
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #444;
    }
  `}</style>
</div>
