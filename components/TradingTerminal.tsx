'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';
import { useEffect, useState } from 'react';

const POPULAR_TOKENS = [
  { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
];

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

export default function TradingTerminal() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [inputToken, setInputToken] = useState(POPULAR_TOKENS[0]);
  const [outputToken, setOutputToken] = useState(POPULAR_TOKENS[1]);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  
  // Pump.fun state
  const [pumpCoins, setPumpCoins] = useState<PumpCoin[]>([]);
  const [activeTab, setActiveTab] = useState<'new' | 'graduating' | 'graduated'>('new');

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
    const interval = setInterval(fetchPumpCoins, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    setLoading(true);
    setStatus('Getting quote...');
    
    try {
      const amountLamports = Math.floor(parseFloat(amount) * Math.pow(10, inputToken.decimals));
      
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint: inputToken.mint,
          outputMint: outputToken.mint,
          amount: amountLamports,
        }),
      });

      const data = await response.json();
      setQuote(data);
      setStatus(`Quote: ${(data.outAmount / Math.pow(10, outputToken.decimals)).toFixed(6)} ${outputToken.symbol}`);
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
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const swapTokens = () => {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    setQuote(null);
  };

  const getBondingProgress = (coin: PumpCoin) => {
    const GRADUATION_THRESHOLD = 85; // SOL needed to graduate
    const currentSOL = coin.virtual_sol_reserves / 1e9;
    return Math.min((currentSOL / GRADUATION_THRESHOLD) * 100, 100);
  };

  const getFilteredCoins = () => {
    if (activeTab === 'new') {
      return pumpCoins.filter(c => !c.complete).slice(0, 10);
    } else if (activeTab === 'graduating') {
      return pumpCoins.filter(c => !c.complete && getBondingProgress(c) > 70).slice(0, 10);
    } else {
      return pumpCoins.filter(c => c.complete).slice(0, 10);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const formatMarketCap = (mc: number) => {
    if (mc >= 1000000) return `$${(mc / 1000000).toFixed(1)}M`;
    if (mc >= 1000) return `$${(mc / 1000).toFixed(0)}K`;
    return `$${mc.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Nav */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">MEMECOIN TERMINAL</h1>
            <nav className="flex gap-4 text-sm">
              <button className="text-purple-400 font-semibold">Trade</button>
              <button className="text-gray-500 hover:text-gray-300">Portfolio</button>
              <button className="text-gray-500 hover:text-gray-300">Challenges</button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {publicKey && (
              <div className="text-sm text-gray-400">
                {balance.toFixed(2)} SOL
              </div>
            )}
            <WalletMultiButton />
          </div>
        </div>
      </div>

      {/* 3 Column Layout */}
      <div className="grid grid-cols-12 gap-4 p-4 h-[calc(100vh-60px)]">
        
        {/* LEFT COLUMN - Pump.fun Tokens */}
        <div className="col-span-3 space-y-4 overflow-y-auto">
          {/* Pump.fun Tabs */}
          <div className="bg-gray-900 rounded-lg border border-gray-800">
            <div className="flex border-b border-gray-800">
              <button
                onClick={() => setActiveTab('new')}
                className={`flex-1 py-2 text-xs font-semibold ${
                  activeTab === 'new' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'
                }`}
              >
                NEW 🔥
              </button>
              <button
                onClick={() => setActiveTab('graduating')}
                className={`flex-1 py-2 text-xs font-semibold ${
                  activeTab === 'graduating' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500'
                }`}
              >
                GRADUATING 🚀
              </button>
              <button
                onClick={() => setActiveTab('graduated')}
                className={`flex-1 py-2 text-xs font-semibold ${
                  activeTab === 'graduated' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'
                }`}
              >
                GRADUATED ✅
              </button>
            </div>

            <div className="p-2 space-y-1 max-h-[600px] overflow-y-auto">
              {getFilteredCoins().map((coin) => (
                <button
                  key={coin.mint}
                  onClick={() => {
                    setInputToken({
                      symbol: coin.symbol,
                      mint: coin.mint,
                      decimals: 6
                    });
                    setQuote(null);
                  }}
                  className="w-full p-2 hover:bg-gray-800 rounded transition text-left"
                >
                  <div className="flex items-start gap-2">
                    <img 
                      src={coin.image_uri} 
                      alt={coin.name}
                      className="w-10 h-10 rounded-full bg-gray-800"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23374151" width="100" height="100"/%3E%3C/svg%3E';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm truncate">{coin.name}</span>
                        <span className="text-xs text-gray-500">{formatTimeAgo(coin.created_timestamp)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400">${coin.symbol}</span>
                        <span className="text-xs font-semibold text-green-400">{formatMarketCap(coin.market_cap)}</span>
                      </div>
                      {!coin.complete && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Bonding</span>
                            <span className="text-purple-400">{getBondingProgress(coin).toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-1">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-pink-500 h-1 rounded-full transition-all"
                              style={{width: `${getBondingProgress(coin)}%`}}
                            ></div>
                          </div>
                        </div>
                      )}
                      {coin.complete && (
                        <div className="mt-1 text-xs text-green-400 flex items-center gap-1">
                          ✅ Graduated to Raydium
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              
              {getFilteredCoins().length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No coins in this category
                </div>
              )}
            </div>
          </div>

          {/* Prop Challenge */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-400">PROP CHALLENGE</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Current Level</span>
                <span className="text-sm font-semibold">Demo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Progress</span>
                <span className="text-sm font-semibold">0%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full" style={{width: '0%'}}></div>
              </div>
              <button className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-lg text-sm font-semibold mt-2">
                Start Challenge
              </button>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN - Chart */}
        <div className="col-span-6 bg-gray-900 rounded-lg border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">{inputToken.symbol}/SOL</h2>
              <div className="text-sm text-gray-400">Price Chart</div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded">1H</button>
              <button className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded">4H</button>
              <button className="px-3 py-1 text-xs bg-purple-600 rounded">1D</button>
              <button className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded">1W</button>
            </div>
          </div>
          
          {/* Placeholder Chart */}
          <div className="h-[calc(100%-80px)] bg-gray-950 rounded-lg border border-gray-800 flex items-center justify-center">
            <div className="text-center text-gray-600">
              <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <p className="text-sm">Price chart coming soon</p>
              <p className="text-xs mt-1">Live TradingView integration</p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Trading Panel */}
        <div className="col-span-3 space-y-4 overflow-y-auto">
          {/* Trade Panel */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <div className="flex gap-2 mb-4">
              <button className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded text-sm font-semibold">
                BUY
              </button>
              <button className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 rounded text-sm font-semibold text-gray-400">
                SELL
              </button>
            </div>

            {/* Input Token */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 mb-2 block">YOU PAY</label>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{inputToken.symbol}</div>
                  {publicKey && (
                    <span className="text-xs text-gray-500">
                      Balance: {balance.toFixed(4)}
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

            {/* Swap Arrow */}
            <div className="flex justify-center -my-2 relative z-10">
              <button
                onClick={swapTokens}
                disabled={!publicKey}
                className="bg-gray-800 hover:bg-gray-700 p-2 rounded-full border-2 border-gray-900 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* Output Token */}
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-2 block">YOU RECEIVE</label>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{outputToken.symbol}</div>
                </div>
                <div className="text-2xl font-bold text-gray-400">
                  {quote ? (quote.outAmount / Math.pow(10, outputToken.decimals)).toFixed(6) : '0.00'}
                </div>
              </div>
            </div>

            {/* Trade Button */}
            {!publicKey ? (
              <button
                disabled
                className="w-full bg-gray-700 py-3 rounded-lg font-bold cursor-not-allowed"
              >
                CONNECT WALLET
              </button>
            ) : !quote ? (
              <button
                onClick={getQuote}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 py-3 rounded-lg font-bold disabled:cursor-not-allowed"
              >
                {loading ? 'LOADING...' : 'GET QUOTE'}
              </button>
            ) : (
              <button
                onClick={executeSwap}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-700 disabled:to-gray-700 py-3 rounded-lg font-bold disabled:cursor-not-allowed"
              >
                {loading ? 'SWAPPING...' : 'EXECUTE SWAP'}
              </button>
            )}

            {/* Status */}
            {status && (
              <div className="mt-3 p-2 bg-gray-950 border border-gray-800 rounded text-xs text-center text-gray-400">
                {status}
              </div>
            )}
          </div>

          {/* Recent Trades */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-400">RECENT TRADES</h3>
            <div className="space-y-2 text-xs">
              <div className="text-gray-500 text-center py-4">
                No trades yet
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
