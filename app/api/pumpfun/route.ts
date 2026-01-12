import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // PumpPortal API - Real Pump.fun tokens only
    const response = await fetch('https://pumpportal.fun/api/data', {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    });

    if (response.ok) {
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        console.log('✅ PumpPortal API - Found', data.length, 'real tokens');
        
        // Transform to our format
        const tokens = data.map((token: any) => ({
          mint: token.mint || token.address,
          name: token.name || token.symbol,
          symbol: token.symbol || 'UNKNOWN',
          description: token.description || '',
          image_uri: token.image || token.uri || 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
          twitter: token.twitter,
          telegram: token.telegram,
          website: token.website,
          market_cap: token.usd_market_cap || 0,
          created_timestamp: token.created_timestamp || Date.now(),
          complete: token.complete || false,
          raydium_pool: token.raydium_pool,
          virtual_sol_reserves: token.virtual_sol_reserves || 0,
          virtual_token_reserves: token.virtual_token_reserves || 0,
        }));
        
        return NextResponse.json(tokens);
      }
    }

    // If PumpPortal fails, return empty array (WebSocket will handle updates)
    console.log('⚠️ No data from PumpPortal API, relying on WebSocket');
    return NextResponse.json([]);

  } catch (error: any) {
    console.error('PumpPortal API error:', error.message);
    return NextResponse.json([]);
  }
}
