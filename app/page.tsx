export const dynamic = 'force-dynamic';
import PumpFunPulseHelius from '@/components/PumpFunPulseHelius';
export default function HomePage() {
  return (
    <div className="h-screen bg-gray-950">
      <PumpFunPulseHelius 
        onTokenSelect={(mint, token) => {
          console.log('Selected token:', mint);
        }}
      />
    </div>
  );
}
