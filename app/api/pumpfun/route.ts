import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Try DexScreener API for new Solana tokens (more reliable)
    const dexResponse = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112', {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 10 }
    });

    if (dexResponse.ok) {
      const dexData = await dexResponse.json();
      
      // Transform DexScreener data to our format
      if (dexData.pairs && Array.isArray(dexData.pairs)) {
        const coins = dexData.pairs.slice(0, 50).map((pair: any) => ({
          mint: pair.baseToken.address,
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
          description: `${pair.baseToken.name} on ${pair.dexId}`,
          image_uri: pair.info?.imageUrl || 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
          market_cap: pair.fdv || pair.marketCap || 0,
          created_timestamp: pair.pairCreatedAt || Date.now(),
          complete: true, // DexScreener shows graduated tokens
          raydium_pool: pair.pairAddress,
          virtual_sol_reserves: 100000000000,
          virtual_token_reserves: 1000000000000,
        }));
        
        console.log('✅ Using DexScreener API - Found', coins.length, 'tokens');
        return NextResponse.json(coins);
      }
    }

    // Fallback: Try Pump.fun API
    const pumpResponse = await fetch('https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=last_trade_timestamp&order=DESC&includeNsfw=false', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      next: { revalidate: 10 }
    });

    if (pumpResponse.ok) {
      const pumpData = await pumpResponse.json();
      if (Array.isArray(pumpData)) {
        console.log('✅ Using Pump.fun API - Found', pumpData.length, 'tokens');
        return NextResponse.json(pumpData);
      }
    }

    // Final fallback: Return curated mock data
    console.log('⚠️ Both APIs failed, using mock data');
    return NextResponse.json(getMockData());

  } catch (error) {
    console.error('All Pump.fun sources failed:', error);
    return NextResponse.json(getMockData());
  }
}

function getMockData() {
  const now = Date.now();
  return [
    {
      mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      name: 'Bonk',
      symbol: 'BONK',
      description: 'The first Solana dog coin',
      image_uri: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
      market_cap: 450000000,
      created_timestamp: now - 7200000,
      complete: true,
      raydium_pool: 'pool123',
      virtual_sol_reserves: 100000000000,
      virtual_token_reserves: 1000000000000,
    },
    {
      mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      name: 'dogwifhat',
      symbol: 'WIF',
      description: 'Just a dog with a hat',
      image_uri: 'https://bafkreidgjbv3npx63wtau4jfip5r6q7xlbsoezbqzj2rb3mgdsvbmsfhfy.ipfs.nftstorage.link',
      market_cap: 380000000,
      created_timestamp: now - 3600000,
      complete: true,
      raydium_pool: 'pool456',
      virtual_sol_reserves: 90000000000,
      virtual_token_reserves: 900000000000,
    },
    {
      mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
      name: 'Popcat',
      symbol: 'POPCAT',
      description: 'Pop pop pop',
      image_uri: 'https://bafkreifc4buqh4vfnfi6bdkgev5scbmo6clxz7j46gm7ggwt2ndqcm2p2e.ipfs.nftstorage.link',
      market_cap: 125000000,
      created_timestamp: now - 1800000,
      complete: true,
      virtual_sol_reserves: 75000000000,
      virtual_token_reserves: 750000000000,
    },
    {
      mint: 'A8C1BdramwXa7XCQMoYpvJXvXDRmEJ6hqNz24YRb7yzb',
      name: 'Michi',
      symbol: 'MICHI',
      description: 'Solana cat coin',
      image_uri: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
      market_cap: 85000000,
      created_timestamp: now - 5400000,
      complete: true,
      raydium_pool: 'pool789',
      virtual_sol_reserves: 65000000000,
      virtual_token_reserves: 650000000000,
    },
    {
      mint: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
      name: 'cat in a dogs world',
      symbol: 'MEW',
      description: 'A cat in a dogs world',
      image_uri: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
      market_cap: 92000000,
      created_timestamp: now - 4800000,
      complete: true,
      raydium_pool: 'pool101',
      virtual_sol_reserves: 70000000000,
      virtual_token_reserves: 700000000000,
    },
  ];
}
