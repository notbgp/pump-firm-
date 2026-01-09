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

  useEffect(() => {
    if (publicKey) {
      connection.getBalance(publicKey).then((bal) => {
        setBalance(bal / LAMPORTS_PER_SOL);
      });
    }
  }, [publicKey, connection]);

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
      
      // Refresh balance
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Memecoin Terminal
            </h1>
            <p className="text-gray-400">
              Trade Solana memecoins with Jupiter
            </p>
          </div>
          <WalletMultiButton />
        </div>

        {/* Balance Display */}
        {publicKey && (
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Wallet Balance</div>
            <div className="text-3xl font-bold text-white">
              {balance.toFixed(4)} SOL
            </div>
          </div>
        )}

        {/* Trading Card */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          {/* Input Token */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">You Pay</label>
            <div className="flex gap-2">
              <select
                value={inputToken.symbol}
                onChange={(e) => {
                  const token = POPULAR_TOKENS.find(t => t.symbol === e.target.value);
                  if (token) setInputToken(token);
                  setQuote(null);
                }}
                disabled={!publicKey}
                className="bg-white/10 text-white px-4 py-3 rounded-xl border border-white/20 focus:border-purple-500 outline-none disabled:opacity-50"
              >
                {POPULAR_TOKENS.map(token => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setQuote(null);
                }}
                placeholder="0.00"
                disabled={!publicKey}
                className="flex-1 bg-white/10 text-white px-4 py-3 rounded-xl border border-white/20 focus:border-purple-500 outline-none text-right text-xl disabled:opacity-50"
              />
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center my-4">
            <button
              onClick={swapTokens}
              disabled={!publicKey}
              className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* Output Token */}
          <div className="mb-6">
            <label className="text-gray-400 text-sm mb-2 block">You Receive</label>
            <div className="flex gap-2">
              <select
                value={outputToken.symbol}
                onChange={(e) => {
                  const token = POPULAR_TOKENS.find(t => t.symbol === e.target.value);
                  if (token) setOutputToken(token);
                  setQuote(null);
                }}
                disabled={!publicKey}
                className="bg-white/10 text-white px-4 py-3 rounded-xl border border-white/20 focus:border-purple-500 outline-none disabled:opacity-50"
              >
                {POPULAR_TOKENS.map(token => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </option>
                ))}
              </select>
              <div className="flex-1 bg-white/5 text-gray-400 px-4 py-3 rounded-xl border border-white/10 text-right text-xl">
                {quote ? (quote.outAmount / Math.pow(10, outputToken.decimals)).toFixed(6) : '0.00'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {!publicKey ? (
              <button
                disabled
                className="w-full bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold py-4 rounded-xl cursor-not-allowed"
              >
                Connect Wallet to Trade
              </button>
            ) : !quote ? (
              <button
                onClick={getQuote}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-4 rounded-xl transition-all disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Get Quote'}
              </button>
            ) : (
              <button
                onClick={executeSwap}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-4 rounded-xl transition-all disabled:cursor-not-allowed"
              >
                {loading ? 'Swapping...' : 'Execute Swap'}
              </button>
            )}
          </div>

          {/* Status */}
          {status && (
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-gray-300 text-sm text-center">{status}</p>
            </div>
          )}

          {/* Info for non-connected users */}
          {!publicKey && (
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-blue-300 text-sm text-center">
                💡 Connect your Solana wallet to get live quotes and execute swaps
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Powered by Jupiter • Solana Mainnet</p>
        </div>
      </div>
    </div>
  );
}
