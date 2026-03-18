'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchDashboardSummary, type DashboardSummary } from '../../../lib/api';

const quickActions = [
  { label: 'Mark Attendance', href: '/attendance' },
  { label: 'Add Student', href: '/students' },
  { label: 'Record Payment', href: '/dashboard' },
];

function formatCurrencyFromPaise(value: number): string {
  return `₹${(value / 100).toLocaleString('en-IN')}`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');

      try {
        const data = await fetchDashboardSummary();
        setSummary(data);
      } catch (requestError) {
        const messageText = requestError instanceof Error ? requestError.message : 'Failed to load dashboard';
        setError(messageText);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const revenueChartData = useMemo(() => {
    if (!summary) {
      return [] as Array<{ month: string; collectedRupees: number }>;
    }

    return summary.monthlyRevenue.map((row) => ({
      month: row.month,
      collectedRupees: Math.round(row.totalCollected / 100),
    }));
  }, [summary]);

  return (
    <section className="space-y-6">
      <header className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Live operational view for attendance, fees, and schedule.</p>
      </header>

      {loading ? <p className="text-sm text-slate-600">Loading dashboard...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {summary ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-sm font-medium text-slate-500">Students Enrolled</h2>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{summary.kpis.studentsEnrolled}</p>
            </article>

            <article className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-sm font-medium text-slate-500">Active Batches</h2>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{summary.kpis.activeBatches}</p>
            </article>

            <article className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-sm font-medium text-slate-500">Today Attendance</h2>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                {summary.kpis.todayAttendance.present} present / {summary.kpis.todayAttendance.absent} absent
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Late: {summary.kpis.todayAttendance.late} • Total marked: {summary.kpis.todayAttendance.totalMarked}
              </p>
            </article>

            <article className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-sm font-medium text-slate-500">Pending Fees</h2>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {formatCurrencyFromPaise(summary.kpis.pendingFees)}
              </p>
            </article>

            <article className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-sm font-medium text-slate-500">Upcoming Classes</h2>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{summary.upcomingClasses.length}</p>
            </article>

            <article className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-sm font-medium text-slate-500">Trial Students</h2>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{summary.kpis.trialStudents}</p>
            </article>
          </section>

          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Overdue Fee Alerts</h2>
              {summary.overdueFees.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No overdue fees currently.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {summary.overdueFees.map((fee) => (
                    <li key={fee.studentFeeId} className="rounded-md border border-slate-200 px-3 py-2">
                      <p className="font-medium">{fee.studentName}</p>
                      <p>
                        {fee.studentCode} • {formatCurrencyFromPaise(fee.amountDue)} • Due{' '}
                        {new Date(fee.dueDate).toLocaleDateString('en-IN')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Upcoming Batch Schedule</h2>
              {summary.upcomingClasses.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No upcoming classes in the next two weeks.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {summary.upcomingClasses.map((session) => (
                    <li key={`${session.batchId}-${session.classDate}`} className="rounded-md border border-slate-200 px-3 py-2">
                      <p className="font-medium">{session.batchName}</p>
                      <p>
                        {new Date(session.classDate).toLocaleDateString('en-IN')} • {formatTime(session.startTime)}
                        {' - '}
                        {formatTime(session.endTime)}
                      </p>
                      <p className="text-xs text-slate-600">
                        {session.subject}
                        {session.room ? ` • Room ${session.room}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Low Attendance Alerts</h2>
              {summary.lowAttendanceAlerts.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No students below 75% attendance.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {summary.lowAttendanceAlerts.map((student) => (
                    <li key={student.studentId} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                      <p className="font-medium text-amber-900">{student.studentName}</p>
                      <p className="text-amber-800">
                        {student.studentCode} • {student.attendancePercent}% attendance
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Monthly Revenue Trend</h2>
              <div className="mt-4 h-64 w-full text-slate-900">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="collectedRupees" fill="currentColor" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </section>
  );
}
