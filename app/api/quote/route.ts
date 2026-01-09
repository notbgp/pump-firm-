import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { inputMint, outputMint, amount } = await request.json();

    const quoteResponse = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`
    );

    const quote = await quoteResponse.json();

    return NextResponse.json(quote);
  } catch (error) {
    console.error('Quote error:', error);
    return NextResponse.json(
      { error: 'Failed to get quote' },
      { status: 500 }
    );
  }
}
