export interface PumpToken {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  created_timestamp: number;
  market_cap: number;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  complete: boolean;
  raydium_pool?: string;
}

export class PumpPortalWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private onTokenCallback: ((token: PumpToken) => void) | null = null;
  private isClient: boolean = false;

  connect(onNewToken: (token: PumpToken) => void) {
    if (typeof window === 'undefined') {
      return;
    }

    this.isClient = true;
    this.onTokenCallback = onNewToken;
    this.connectWebSocket();
  }

  private connectWebSocket() {
    if (!this.isClient) return;

    try {
      console.log('🔌 Connecting to PumpPortal WebSocket...');
      this.ws = new WebSocket('wss://pumpportal.fun/api/data');

      this.ws.onopen = () => {
        console.log('✅ Connected to PumpPortal - Listening for real Pump.fun tokens');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Only process actual token creation events
          if (data.txType === 'create' && data.mint) {
            const token: PumpToken = {
              mint: data.mint,
              name: data.name || data.symbol || 'Unknown',
              symbol: data.symbol || 'TKN',
              description: data.description || '',
              image_uri: data.uri || data.image || 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
              twitter: data.twitter,
              telegram: data.telegram,
              website: data.website,
              created_timestamp: data.timestamp || Date.now(),
              market_cap: data.usd_market_cap || 0,
              virtual_sol_reserves: data.vSolInBondingCurve || 0,
              virtual_token_reserves: data.vTokensInBondingCurve || 0,
              complete: false,
            };

            console.log('🔥 NEW PUMP.FUN TOKEN CREATED:', token.symbol, '-', token.name);
            console.log('   CA:', token.mint);
            console.log('   MC:', `$${token.market_cap.toLocaleString()}`);

            if (this.onTokenCallback) {
              this.onTokenCallback(token);
            }
          }
          
          // Also handle trade/buy events to update existing tokens
          else if (data.txType === 'buy' || data.txType === 'sell') {
            console.log('💰', data.txType.toUpperCase(), ':', data.symbol, '-', data.sol_amount, 'SOL');
          }
          
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ PumpPortal WebSocket error');
      };

      this.ws.onclose = () => {
        console.log('🔌 Disconnected from PumpPortal. Reconnecting in 3s...');
        this.reconnectTimeout = setTimeout(() => {
          this.connectWebSocket();
        }, 3000);
      };
    } catch (error) {
      console.error('❌ Failed to connect:', error);
      // Retry connection
      this.reconnectTimeout = setTimeout(() => {
        this.connectWebSocket();
      }, 3000);
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    console.log('👋 Disconnected from PumpPortal');
  }
}
