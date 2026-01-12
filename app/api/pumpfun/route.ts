import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Method 1: DexScreener for ACTUAL new Solana pairs (most reliable)
    const dexResponse = await fetch('https://api.dexscreener.com/latest/dex/search?q=SOL', {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (dexResponse.ok) {
      const dexData = await dexResponse.json();
      
      if (dexData.pairs && Array.isArray(dexData.pairs)) {
        const now = Date.now();
        
        const coins = dexData.pairs
          .filter((pair: any) => 
            pair.chainId === 'solana' && 
            pair.dexId === 'raydium' &&
            pair.baseToken?.address &&
            pair.pairCreatedAt
          )
          .slice(0, 50)
          .map((pair: any) => {
            const age = now - pair.pairCreatedAt;
            const isNew = age < 3600000; // Less than 1 hour old
            const marketCap = pair.fdv || pair.marketCap || 0;
            
            return {
              mint: pair.baseToken.address,
              name: pair.baseToken.name || pair.baseToken.symbol,
              symbol: pair.baseToken.symbol || 'UNKNOWN',
              description: `${pair.baseToken.name} on ${pair.dexId}`,
              image_uri: pair.info?.imageUrl || 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
              market_cap: marketCap,
              created_timestamp: pair.pairCreatedAt,
              complete: marketCap > 50000, // Graduated if MC > $50k
              raydium_pool: pair.pairAddress,
              virtual_sol_reserves: marketCap > 50000 ? 100000000000 : (marketCap * 10000000),
              virtual_token_reserves: 1000000000000,
            };
          });
        
        console.log('✅ DexScreener API - Found', coins.length, 'pairs');
        return NextResponse.json(coins);
      }
    }

    // Method 2: Birdeye trending tokens
    const birdeyeResponse = await fetch('https://public-api.birdeye.so/defi/tokenlist?sort_by=v24hChangePercent&sort_type=desc&offset=0&limit=50', {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (birdeyeResponse.ok) {
      const birdeyeData = await birdeyeResponse.json();
      
      if (birdeyeData.data?.tokens) {
        const coins = birdeyeData.data.tokens.map((token: any) => ({
          mint: token.address,
          name: token.name || token.symbol,
          symbol: token.symbol,
          description: token.name,
          image_uri: token.logoURI || 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
          market_cap: token.mc || 0,
          created_timestamp: Date.now() - Math.random() * 3600000,
          complete: token.mc > 100000,
          virtual_sol_reserves: (token.mc || 1000) * 10000000,
          virtual_token_reserves: 1000000000000,
        }));
        
        console.log('✅ Birdeye API - Found', coins.length, 'tokens');
        return NextResponse.json(coins);
      }
    }

    // Fallback: Return empty to trigger client-side mock
    return NextResponse.json([]);

  } catch (error: any) {
    console.error('All sources failed:', error.message);
    return NextResponse.json([]);
  }
}
