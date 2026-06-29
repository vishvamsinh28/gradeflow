const panelClass = "rounded-2xl border border-[#8496b01f] bg-[#132338] p-5 shadow-[0_18px_48px_rgba(0,0,0,.12)] sm:p-6";

export function PageLoading({ title = "Loading workspace", detail = "Fetching the latest GradeFlow data." }: { title?: string; detail?: string }) {
  return (
    <section className={`${panelClass} mt-6`}>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="h-3 w-28 animate-pulse rounded-full bg-[#00c9a733]" />
          <h2 className="mt-4 font-display text-2xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-[#8496B0]">{detail}</p>
        </div>
        <div className="h-10 w-28 animate-pulse rounded-xl bg-[#8496b01f]" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </section>
  );
}

export function InlineLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4" key={index}>
          <div className="h-3 w-1/4 animate-pulse rounded-full bg-[#00c9a733]" />
          <div className="mt-4 h-4 w-2/3 animate-pulse rounded-full bg-[#8496b026]" />
          <div className="mt-3 h-3 w-1/2 animate-pulse rounded-full bg-[#8496b01f]" />
        </div>
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#8496b01f] bg-[#0B1829] p-4">
      <div className="h-3 w-20 animate-pulse rounded-full bg-[#00c9a733]" />
      <div className="mt-5 h-5 w-3/4 animate-pulse rounded-full bg-[#8496b026]" />
      <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-[#8496b01f]" />
      <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-[#8496b01f]" />
    </div>
  );
}
