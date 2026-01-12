import PumpFunPulse from '@/components/PumpFunPulse';
import TradingChart from '@/components/TradingChart';
import OrderBook from '@/components/OrderBook';

export default function TradingPage() {
  return (
    <div className="grid grid-cols-4 gap-2 h-screen bg-gray-950 p-2">
      {/* Left Sidebar - New Tokens Feed */}
      <div className="col-span-1 border border-gray-800 rounded-lg overflow-hidden">
        <PumpFunPulse />
      </div>

      {/* Center - Chart */}
      <div className="col-span-2 border border-gray-800 rounded-lg">
        <TradingChart />
      </div>

      {/* Right Sidebar - Order Book / Trades */}
      <div className="col-span-1 border border-gray-800 rounded-lg">
        <OrderBook />
      </div>
    </div>
  );
}
