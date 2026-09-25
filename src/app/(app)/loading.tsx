export default function AppLoading() {
  return (
    <main className="page-frame animate-pulse py-8" aria-label="Loading">
      <div className="h-3 w-28 rounded bg-slate-200" />
      <div className="mt-3 h-9 w-52 rounded bg-slate-200" />
      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-4">
          <div className="h-48 rounded-2xl bg-white" />
          <div className="h-80 rounded-2xl bg-white" />
        </div>
        <div className="h-80 rounded-2xl bg-white" />
      </div>
      <span className="sr-only">Loading page…</span>
    </main>
  );
}

