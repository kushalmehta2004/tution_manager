import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">Tuition Manager</h1>
      <p className="max-w-2xl text-slate-600">
        Foundation setup is ready. Use auth endpoints from the API and start building dashboard
        modules in upcoming phases.
      </p>
      <div className="flex gap-3">
        <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" href="/dashboard">
          Open Dashboard Shell
        </Link>
      </div>
    </main>
  );
}
