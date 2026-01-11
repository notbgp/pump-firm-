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

  connect(onNewToken: (token: PumpToken) => void) {
    this.onTokenCallback = onNewToken;
    this.connectWebSocket();
  }

  private connectWebSocket() {
    try {
      this.ws = new WebSocket('wss://pumpportal.fun/api/data');

      this.ws.onopen = () => {
        console.log('✅ Connected to PumpPortal WebSocket');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message types
          if (data.txType === 'create') {
            const token: PumpToken = {
              mint: data.mint,
              name: data.name || 'Unknown',
              symbol: data.symbol || 'TKN',
              description: data.description || '',
              image_uri: data.uri || data.image || 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
              twitter: data.twitter,
              telegram: data.telegram,
              website: data.website,
              created_timestamp: data.timestamp || Date.now(),
              market_cap: data.marketCapSol ? data.marketCapSol * 1000 : 1000, // Convert SOL to USD estimate
              virtual_sol_reserves: data.vSolInBondingCurve || 1000000000,
              virtual_token_reserves: data.vTokensInBondingCurve || 10000000000,
              complete: false,
            };

            if (this.onTokenCallback) {
              this.onTokenCallback(token);
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ PumpPortal WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('🔌 PumpPortal WebSocket disconnected. Reconnecting in 5s...');
        this.reconnectTimeout = setTimeout(() => {
          this.connectWebSocket();
        }, 5000);
      };
    } catch (error) {
      console.error('Failed to connect to PumpPortal:', error);
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
  }
}
