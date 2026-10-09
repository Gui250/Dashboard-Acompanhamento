// Mesma coluna estreita da página: intro e um bloco por integração, o escuro por último é o MCP.
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-7" aria-hidden>
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-primary/15" />
        <div className="h-9 w-3/4 animate-pulse rounded bg-white" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-white/70" />
      </div>
      {[300, 280, 190].map((height, index) => <div key={index} className="animate-pulse rounded-lg border bg-white/70" style={{ height }} />)}
      <div className="h-[380px] animate-pulse rounded-lg bg-[#171717]/90" />
    </div>
  );
}
