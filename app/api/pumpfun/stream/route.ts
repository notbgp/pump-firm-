import { NextRequest } from 'next/server';
import WebSocket from 'ws';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const ws = new WebSocket('wss://pumpportal.fun/api/data');

      ws.on('open', () => {
        ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
      });

      ws.on('message', (data: WebSocket.Data) => {
        const message = `data: ${data}\n\n`;
        controller.enqueue(new TextEncoder().encode(message));
      });

      ws.on('error', (error) => controller.error(error));
      ws.on('close', () => controller.close());

      request.signal.addEventListener('abort', () => ws.close());
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
