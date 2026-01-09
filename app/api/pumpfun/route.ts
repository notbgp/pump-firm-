import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch('https://client-api-2-74b1891ee9f9.herokuapp.com/coins?offset=0&limit=50&sort=last_trade_timestamp&order=DESC&includeNsfw=false', {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Pump.fun API error:', response.status);
      return NextResponse.json([], { status: 200 }); // Return empty array instead of error
    }

    const data = await response.json();
    
    // Make sure we return an array
    if (Array.isArray(data)) {
      return NextResponse.json(data);
    } else {
      console.error('Unexpected data format:', data);
      return NextResponse.json([], { status: 200 });
    }
  } catch (error) {
    console.error('Pump.fun fetch error:', error);
    // Return empty array so the app doesn't crash
    return NextResponse.json([], { status: 200 });
  }
}
