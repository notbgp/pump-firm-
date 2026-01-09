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

      {/* 4 Column Layout - Axiom Style */}
      <div className="grid grid-cols-12
