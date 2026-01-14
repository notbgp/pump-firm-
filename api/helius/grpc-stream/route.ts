import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // For now, send a test event every 5 seconds
        // This is a placeholder until we properly configure gRPC
        const interval = setInterval(() => {
          const testToken = {
            type: 'newToken',
            signature: 'test-' + Date.now(),
            mint: 'TestMintAddress' + Math.random().toString(36).substring(7),
            creator: 'TestCreator',
            slot: Math.floor(Math.random() * 1000000),
            timestamp: Date.now(),
          };

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(testToken)}\n\n`)
          );
        }, 5000);

        // Send connected message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
        );

        // Clean up on disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(interval);
          controller.close();
        });

      } catch (error) {
        console.error('Error:', error);
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
