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
  private simulationInterval: NodeJS.Timeout | null = null;
  private onTokenCallback: ((token: PumpToken) => void) | null = null;
  private isClient: boolean = false;
  private lastTokenTime: number = 0;

  connect(onNewToken: (token: PumpToken) => void) {
    if (typeof window === 'undefined') {
      return;
    }

    this.isClient = true;
    this.onTokenCallback = onNewToken;
    this.connectWebSocket();
    this.startSimulation(); // Add simulated tokens for demo
  }

  private connectWebSocket() {
    if (!this.isClient) return;

    try {
      console.log('🔌 Connecting to PumpPortal...');
      this.ws = new WebSocket('wss://pumpportal.fun/api/data');

      this.ws.onopen = () => {
        console.log('✅ PumpPortal WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.txType === 'create' && data.mint) {
            this.lastTokenTime = Date.now();
            
            const token: PumpToken = {
              mint: data.mint,
              name: data.name || 'Unknown',
              symbol: data.symbol || 'TKN',
              description: data.description || '',
              image_uri: data.uri || data.image || 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
              twitter: data.twitter,
              telegram: data.telegram,
              website: data.website,
              created_timestamp: Date.now(),
              market_cap: data.marketCapSol ? data.marketCapSol * 150 : 1000,
              virtual_sol_reserves: data.vSolInBondingCurve || 5000000000,
              virtual_token_reserves: data.vTokensInBondingCurve || 50000000000,
              complete: false,
            };

            console.log('🔥 Real token from PumpPortal:', token.symbol);

            if (this.onTokenCallback) {
              this.onTokenCallback(token);
            }
          }
        } catch (error) {
          console.error('Parse error:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('🔌 Disconnected. Reconnecting...');
        this.reconnectTimeout = setTimeout(() => {
          this.connectWebSocket();
        }, 5000);
      };
    } catch (error) {
      console.error('Connection failed:', error);
    }
  }

  private startSimulation() {
    // Generate simulated tokens every 30-90 seconds to keep feed active
    const symbols = ['PEPE', 'DOGE', 'SHIB', 'FLOKI', 'BONK', 'WIF', 'MYRO', 'SAMO', 'COPE', 'ORCA'];
    const adjectives = ['Baby', 'Moon', 'Rocket', 'Super', 'Mega', 'Giga', 'Chad', 'Based', 'Degen'];
    
    this.simulationInterval = setInterval(() => {
      // Only simulate if no real tokens in last 2 minutes
      if (Date.now() - this.lastTokenTime > 120000) {
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const base = symbols[Math.floor(Math.random() * symbols.length)];
        const symbol = `${adj}${base}`.substring(0, 8).toUpperCase();
        
        const simulatedToken: PumpToken = {
          mint: 'SIM' + Math.random().toString(36).substring(2, 15),
          name: `${adj} ${base}`,
          symbol: symbol,
          description: 'Simulated token for demo',
          image_uri: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
          created_timestamp: Date.now(),
          market_cap: Math.floor(Math.random() * 50000) + 1000,
          virtual_sol_reserves: Math.floor(Math.random() * 70000000000) + 10000000000,
          virtual_token_reserves: 100000000000,
          complete: false,
        };

        console.log('🎭 Simulated token:', simulatedToken.symbol);

        if (this.onTokenCallback) {
          this.onTokenCallback(simulatedToken);
        }
      }
    }, 45000); // Every 45 seconds
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
