"use client";

export default function TradingChart(props: { tokenAddress: string }) {
  const tokenAddress = props.tokenAddress;
  
  return (
    <div>
      <div>
        <h1>Token Chart</h1>
        <p>{tokenAddress}</p>
      </div>
      <div>
        <iframe
          src={"https://dexscreener.com/solana/" + tokenAddress + "?embed=1&theme=dark"}
          width="100%"
          height="600"
          title="Chart"
        ></iframe>
      </div>
      <div>
        <a href={"https://pump.fun/" + tokenAddress} target="_blank">
          Pump.fun
        </a>
      </div>
    </div>
  );
}
