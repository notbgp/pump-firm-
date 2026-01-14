import { NextRequest } from 'next/server';
import Client, {
  CommitmentLevel,
  SubscribeRequest,
} from "@triton-one/yellowstone-grpc";

const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let grpcClient: Client | null = null;
      let grpcStream: any = null;

      try {
        grpcClient = new Client(
          process.env.HELIUS_GRPC_ENDPOINT || 'https://mainnet.helius-rpc.com',
          process.env.HELIUS_API_KEY!,
          {
            "grpc.max_receive_message_length": 1024 * 1024 * 100,
          }
        );

        console.log('🔌 Connecting to Helius gRPC...');

        const subscribeRequest: SubscribeRequest = {
          slots: {},
          accounts: {},
          transactions: {
            pumpfun: {
              vote: false,
              failed: false,
              accountInclude: [PUMP_PROGRAM_ID],
              accountExclude: [],
              accountRequired: [PUMP_PROGRAM_ID],
            },
          },
          blocks: {},
          blocksMeta: {},
          entry: {},
          accountsDataSlice: [],
          commitment: CommitmentLevel.CONFIRMED,
        };

        grpcStream = await grpcClient.subscribe(subscribeRequest);
        console.log('✅ Connected to Helius gRPC');

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
        );

        grpcStream.on('data', (data: any) => {
          try {
            if (data.transaction) {
              const tx = data.transaction.transaction;
              const logs = tx?.meta?.logMessages || [];

              const isNewToken = logs.some((log: string) =>
                log.includes('Program log: Instruction: InitializeMint2') ||
                log.includes('Program log: Instruction: Create')
              );

              if (isNewToken) {
                const accountKeys = tx.transaction?.message?.accountKeys || [];
                
                const tokenData = {
                  type: 'newToken',
                  signature: data.transaction.signature,
                  mint: accountKeys[1]?.pubkey || accountKeys[1] || '',
                  creator: accountKeys[0]?.pubkey || accountKeys[0] || '',
                  slot: data.transaction.slot,
                  timestamp: Date.now(),
                };

                console.log('🆕 New token:', tokenData.mint);

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(tokenData)}\n\n`)
                );
              }
            }
          } catch (error) {
            console.error('Error processing gRPC data:', error);
          }
        });

        grpcStream.on('error', (error: Error) => {
          console.error('❌ gRPC stream error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
          );
        });

        grpcStream.on('end', () => {
          console.log('gRPC stream ended');
          controller.close();
        });

        request.signal.addEventListener('abort', async () => {
          console.log('Client disconnected, cleaning up...');
          
          if (grpcStream) {
            grpcStream.removeAllListeners();
          }
          
          if (grpcClient) {
            try {
              await grpcClient.unsubscribe();
            } catch (error) {
              console.error('Error unsubscribing:', error);
            }
          }
        });

      } catch (error) {
        console.error('Failed to initialize gRPC client:', error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Failed to connect' })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
