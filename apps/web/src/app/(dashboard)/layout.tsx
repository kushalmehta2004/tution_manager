import Link from 'next/link';
import type { ReactNode } from 'react';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/students', label: 'Students' },
  { href: '/batches', label: 'Batches' },
  { href: '/attendance', label: 'Attendance' },
  { href: '/dashboard', label: 'Fees' },
  { href: '/dashboard', label: 'Tests' },
  { href: '/dashboard', label: 'Announcements' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">Tuition Manager</p>
          <Link
            href="/dashboard"
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
          >
            Home
          </Link>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3">
          {navLinks.slice(0, 3).map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
          <p className="px-2 text-lg font-semibold">Tuition Manager</p>
          <p className="px-2 pt-1 text-xs text-slate-500">Teacher Dashboard</p>
          <nav className="mt-6 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="hidden border-b border-slate-200 bg-white px-6 py-4 md:block">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Welcome back</p>
                <h1 className="text-lg font-semibold">Teacher Workspace</h1>
              </div>
              <div className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
                Phase 2
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
