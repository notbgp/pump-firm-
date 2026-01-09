import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Fetch latest tokens from Pump.fun
    const response = await fetch('https://client-api-2-74b1891ee9f9.herokuapp.com/coins?offset=0&limit=50&sort=last_trade_timestamp&order=DESC&includeNsfw=false');
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Pump.fun API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Pump.fun data' },
      { status: 500 }
    );
  }
}
