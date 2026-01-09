'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useEffect, useState } from 'react';

export default function TradingTerminal() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (publicKey) {
      connection.getBalance(publicKey).then((bal) => {
        setBalance(bal / LAMPORTS_PER_SOL);
      });
    }
  }, [publicKey, connection]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
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

        {publicKey && (
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/10">
            <div className="text-gray-400 text-sm mb-1">Wallet Balance</div>
            <div className="text-3xl font-bold text-white">
              {balance.toFixed(4)} SOL
            </div>
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          {!publicKey ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">Connect your wallet to start trading</p>
              <WalletMultiButton />
            </div>
          ) : (
            <div className="text-center text-white">
              <p>Trading interface coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
