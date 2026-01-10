import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { tokenMint, solAmount, userPublicKey, action } = await request.json();
    
    // PumpPortal API for bonding curve trades
    const response = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicKey: userPublicKey,
        action: action || 'buy', // 'buy' or 'sell'
        mint: tokenMint,
        amount: solAmount,
        denominatedInSol: 'true',
        slippage: 10,
        priorityFee: 0.0005,
        pool: 'pump'
      })
    });

    if (!response.ok) {
      throw new Error(`PumpPortal API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Pump.fun buy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute Pump.fun trade' },
      { status: 500 }
    );
  }
}
