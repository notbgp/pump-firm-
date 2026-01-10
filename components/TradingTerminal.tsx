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
  { id: 1, name: 'Demo', requiredProfit: 0, maxDrawdown: 0, accountSize: 0, profitSplit: 0, locked: false },
  { id: 2, name: 'Phase 1', requiredProfit: 20, maxDrawdown: 10, accountSize: 100, profitSplit: 50, locked: true },
  { id: 3, name: 'Phase 2', requiredProfit: 15, maxDrawdown: 8, accountSize: 500, profitSplit: 70, locked: true },
  { id: 4, name: 'Funded', requiredProfit: 10, maxDrawdown: 12, accountSize: 5000, profitSplit: 80, locked: true },
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
  
  const [pumpCoins, setPumpCoins] = useState<PumpCoin[]>([]);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  
  const [currentChallenge, setCurrentChallenge] = useState(CHALLENGES[0]);
  const [challengeStats, setChallengeStats] = useState({
    trades: 0,
    winRate: 0,
    totalPnL: 0
  });

  useEffect(() => {
    if (publicKey) {
      connection.getBalance(publicKey).then((bal) => {
        setBalance(bal / LAMPORTS_PER_SOL);
      });
    }
  }, [publicKey, connection]);

  useEffect(() => {
    const fetchPumpCoins = async () => {
      try {
        const response = await fetch('/api/pumpfun');
        const data = await response.json();
        setPumpCoins(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch Pump.fun coins:', error);
        setPumpCoins([]);
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

  const getNewCoins = () => pumpCoins.filter(c => !c.complete).slice(0, 30);
  const getGraduatingCoins = () => pumpCoins.filter(c => !c.complete && getBondingProgress(c) > 70).slice(0, 30);
  const getGraduatedCoins = () => pumpCoins.filter(c => c.complete).slice(0, 30);

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const formatMarketCap = (mc: number) => {
    if (mc >= 1000000) return `$${(mc / 1000000).toFixed(1)}M`;
    if (mc >= 1000) return `$${(mc / 1000).toFixed(0)}K`;
    return `$${mc.toFixed(0)}`;
  };

  const CoinCard = ({ coin }: { coin: PumpCoin }) => (
    <button
      onClick={() => setSelectedCoin(coin)}
      className={`w-full p-2.5 border-b border-gray-800/50 hover:bg-gray-900/50 transition-all text-left ${
        selectedCoin?.mint === coin.mint ? 'bg-purple-900/20 border-l-2 border-l-purple-500' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <img 
          src={coin.image_uri} 
          alt={coin.name}
          className="w-9 h-9 rounded-lg bg-gray-800 object-cover flex-shrink-0"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23374151" width="100" height="100"/%3E%3C/svg%3E';
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="font-bold text-sm truncate">{coin.symbol}</span>
            <span className="text-xs text-gray-500 flex-shrink-0">{formatTimeAgo(coin.created_timestamp)}</span>
          </div>
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <span className="text-xs text-gray-400 truncate">{coin.name}</span>
            <span className="text-xs font-bold text-green-400 flex-shrink-0">{formatMarketCap(coin.market_cap)}</span>
          </div>
          {!coin.complete && (
            <div className="mt-1.5">
              <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                <div 
                  className={`h-1 rounded-full transition-all ${
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
            <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400 font-medium">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Raydium
            </div>
          )}
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Top Nav */}
      <div className="border-b border-gray-800 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center font-bold text-sm">
                PF
              </div>
              <h1 className="text-lg font-bold">Pump Firm</h1>
            </div>
            <nav className="flex gap-1">
              <button className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-lg text-xs font-medium">
                Trade
              </button>
              <button className="px-3 py-1 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg text-xs font-medium">
                Portfolio
              </button>
              <button className="px-3 py-1 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg text-xs font-medium">
                Leaderboard
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {publicKey && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-gray-900 rounded-lg border border-gray-800">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <span className="text-xs font-medium">{balance.toFixed(2)} SOL</span>
              </div>
            )}
            <WalletMultiButton />
          </div>
        </div>
      </div>

      {/* 4 Column Layout */}
      <div className="grid grid-cols-12 gap-2 p-2 h-[calc(100vh-56px)]">
        
        {/* COLUMN 1 - New Tokens */}
        <div className="col-span-2 flex flex-col overflow-hidden">
          <div className="bg-[#111] rounded-lg border border-gray-800 overflow-hidden flex flex-col h-full">
            <div className="bg-gradient-to-b from-purple-600 to-purple-700 px-3 py-2 flex items-center justify-between flex-shrink-0">
              <span className="text-xs font-bold uppercase">New 🔥</span>
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">{getNewCoins().length}</span>
            </div>
            <div className="overflow-y-auto flex-1">
              {getNewCoins().length > 0 ? (
                getNewCoins().map(coin => <CoinCard key={coin.mint} coin={coin} />)
              ) : (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-xs">Loading...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2 - Graduating Tokens */}
        <div className="col-span-2 flex flex-col overflow-hidden">
          <div className="bg-[#111] rounded-lg border border-gray-800 overflow-hidden flex flex-col h-full">
            <div className="bg-gradient-to-b from-yellow-600 to-orange-600 px-3 py-2 flex items-center justify-between flex-shrink-0">
              <span className="text-xs font-bold uppercase">Graduating 🚀</span>
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">{getGraduatingCoins().length}</span>
            </div>
            <div className="overflow-y-auto flex-1">
              {getGraduatingCoins().length > 0 ? (
                getGraduatingCoins().map(coin => <CoinCard key={coin.mint} coin={coin} />)
              ) : (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-xs">None close yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 3 - Graduated Tokens */}
        <div className="col-span-2 flex flex-col overflow-hidden">
          <div className="bg-[#111] rounded-lg border border-gray-800 overflow-hidden flex flex-col h-full">
            <div className="bg-gradient-to-b from-green-600 to-emerald-700 px-3 py-2 flex items-center justify-between flex-shrink-0">
              <span className="text-xs font-bold uppercase">Graduated ✅</span>
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">{getGraduatedCoins().length}</span>
            </div>
            <div className="overflow-y-auto flex-1">
              {getGraduatedCoins().length > 0 ? (
                getGraduatedCoins().map(coin => <CoinCard key={coin.mint} coin={coin} />)
              ) : (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-xs">None yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 4 - Chart */}
        <div className="col-span-3 flex flex-col overflow-hidden">
          <div className="bg-[#111] rounded-lg border border-gray-800 flex flex-col h-full overflow-hidden">
            {selectedCoin ? (
              <>
                <div className="p-3 border-b border-gray-800 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={selectedCoin.image_uri} alt={selectedCoin.name} className="w-8 h-8 rounded-lg" />
                      <div>
                        <h2 className="text-lg font-bold">{selectedCoin.symbol}</h2>
                        <p className="text-xs text-gray-400">{selectedCoin.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-400">{formatMarketCap(selectedCoin.market_cap)}</div>
                      <div className="text-xs text-gray-500">Market Cap</div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-[#0a0a0a] overflow-hidden">
                  <iframe
                    src={`https://dexscreener.com/solana/${selectedCoin.mint}?embed=1&theme=dark&trades=0&info=0`}
                    className="w-full h-full border-0"
                    title={`${selectedCoin.symbol} Chart`}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-gray-600">
                <div>
                  <svg className="w-20 h-20 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  <p className="text-sm font-medium">Select a token to view chart</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 5 - Trading + Challenge */}
        <div className="col-span-3 flex flex-col gap-2 overflow-hidden">
          
          {/* Challenge Card */}
          <div className="bg-[#111] rounded-lg border border-gray-800 p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Prop Challenge</h3>
              <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded font-bold">
                {currentChallenge.name}
              </span>
            </div>
            
            {currentChallenge.id === 1 ? (
              <div className="space-y-2">
                <div className="text-center py-3">
                  <div className="text-2xl font-bold mb-0.5">Demo Mode</div>
                  <p className="text-xs text-gray-400">Practice risk-free trading</p>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="bg-gray-900/50 rounded p-1.5">
                    <div className="text-xs text-gray-500">Trades</div>
                    <div className="text-sm font-bold">{challengeStats.trades}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded p-1.5">
                    <div className="text-xs text-gray-500">Win %</div>
                    <div className="text-sm font-bold">{challengeStats.winRate}%</div>
                  </div>
                  <div className="bg-gray-900/50 rounded p-1.5">
                    <div className="text-xs text-gray-500">PnL</div>
                    <div className="text-sm font-bold text-green-400">+0%</div>
                  </div>
                </div>
                <button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-2 rounded-lg text-xs font-bold">
                  Start Phase 1 ($100)
                </button>
              </div>
            ) : null}
          </div>

          {/* Trading Panel */}
          <div className="bg-[#111] rounded-lg border border-gray-800 p-3 flex-1 flex flex-col overflow-hidden">
            <div className="grid grid-cols-2 gap-1.5 mb-3 flex-shrink-0">
              <button
                onClick={() => setTradeMode('buy')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tradeMode === 'buy' 
                    ? 'bg-gradient-to-b from-green-600 to-green-700 text-white' 
                    : 'bg-gray-900 text-gray-400 hover:text-white'
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setTradeMode('sell')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tradeMode === 'sell' 
                    ? 'bg-gradient-to-b from-red-600 to-red-700 text-white' 
                    : 'bg-gray-900 text-gray-400 hover:text-white'
                }`}
              >
                SELL
              </button>
            </div>

            {selectedCoin ? (
              <div className="flex-1 flex flex-col overflow-y-auto">
                {/* Selected Token Display */}
                <div className="flex items-center gap-2 mb-3 p-2 bg-gray-900/50 rounded-lg flex-shrink-0">
                  <img src={selectedCoin.image_uri} alt={selectedCoin.name} className="w-8 h-8 rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{selectedCoin.symbol}</div>
                    <div className="text-xs text-gray-400 truncate">{selectedCoin.name}</div>
                  </div>
                </div>

                {/* Input */}
                <div className="mb-2 flex-shrink-0">
                  <label className="text-xs text-gray-500 mb-1 block uppercase font-bold">
                    {tradeMode === 'buy' ? 'You Pay' : 'You Sell'}
                  </label>
                  <div className="bg-black/50 border border-gray-800 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">{tradeMode === 'buy' ? 'SOL' : selectedCoin.symbol}</span>
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
                      className="w-full bg-transparent text-xl font-bold outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center my-2 flex-shrink-0">
                  <div className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>

                {/* Output */}
                <div className="mb-3 flex-shrink-0">
                  <label className="text-xs text-gray-500 mb-1 block uppercase font-bold">
                    {tradeMode === 'buy' ? 'You Receive' : 'You Get'}
                  </label>
                  <div className="bg-black/50 border border-gray-800 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">{tradeMode === 'buy' ? selectedCoin.symbol : 'SOL'}</span>
                    </div>
                    <div className="text-xl font-bold text-gray-400">
                      {quote ? (
                        tradeMode === 'buy' 
                          ? (quote.outAmount / 1e6).toFixed(2)
                          : (quote.outAmount / 1e9).toFixed(4)
                      ) : '0.00'}
                    </div>
                  </div>
                </div>

                {/* Button */}
                <div className="flex-shrink-0">
                  {!publicKey ? (
                    <button disabled className="w-full bg-gray-800 py-2.5 rounded-lg font-bold text-sm cursor-not-allowed">
                      CONNECT WALLET
                    </button>
                  ) : !quote ? (
                    <button
                      onClick={getQuote}
                      disabled={loading || !amount || parseFloat(amount) <= 0}
                      className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
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
                      className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        tradeMode === 'buy'
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                          : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
                      }`}
                    >
                      {loading ? 'EXECUTING...' : `${tradeMode === 'buy' ? 'BUY' : 'SELL'} ${selectedCoin.symbol}`}
                    </button>
                  )}

                  {status && (
                    <div className="mt-2 p-1.5 bg-gray-900/50 border border-gray-800 rounded text-xs text-center text-gray-400">
                      {status}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-gray-600">
                <p className="text-xs">Select a token to trade</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
