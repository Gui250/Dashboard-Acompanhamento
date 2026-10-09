export function RouteFallback() {
  return (
    <div className="mx-auto max-w-[1480px] space-y-7">
      <div className="h-28 animate-pulse rounded-lg bg-white/70" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-lg border bg-white/70" />)}
      </div>
      <div className="h-80 animate-pulse rounded-lg border bg-white/70" />
    </div>
  );
}
