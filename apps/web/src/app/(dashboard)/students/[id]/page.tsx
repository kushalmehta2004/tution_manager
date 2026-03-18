'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchStudentAttendanceHeatmap,
  fetchStudentById,
  uploadStudentDocument,
  uploadStudentPhoto,
} from '../../../../lib/api';

type StudentProfile = Awaited<ReturnType<typeof fetchStudentById>>;
type StudentHeatmap = Awaited<ReturnType<typeof fetchStudentAttendanceHeatmap>>;

type HeatmapStatus = 'present' | 'absent' | 'late' | 'holiday' | 'cancelled' | null;

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function statusClass(status: HeatmapStatus): string {
  if (status === 'present') {
    return 'bg-emerald-500';
  }

  if (status === 'absent') {
    return 'bg-rose-500';
  }

  if (status === 'late') {
    return 'bg-amber-500';
  }

  if (status === 'holiday') {
    return 'bg-sky-500';
  }

  if (status === 'cancelled') {
    return 'bg-slate-500';
  }

  return 'bg-slate-200';
}

function shortStatus(status: HeatmapStatus): string {
  if (status === 'present') {
    return 'P';
  }

  if (status === 'absent') {
    return 'A';
  }

  if (status === 'late') {
    return 'L';
  }

  if (status === 'holiday') {
    return 'H';
  }

  if (status === 'cancelled') {
    return 'C';
  }

  return '—';
}

export default function StudentProfilePage({ params }: { params: { id: string } }) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthValue());
  const [heatmap, setHeatmap] = useState<StudentHeatmap | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState<boolean>(false);
  const [heatmapError, setHeatmapError] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await fetchStudentById(params.id);
      setProfile(data);
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : 'Failed to load profile';
      setError(messageText);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;

    async function loadHeatmap() {
      setHeatmapLoading(true);
      setHeatmapError('');

      try {
        const data = await fetchStudentAttendanceHeatmap(params.id, selectedMonth);
        if (!cancelled) {
          setHeatmap(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          const messageText = requestError instanceof Error ? requestError.message : 'Failed to load attendance heatmap';
          setHeatmapError(messageText);
        }
      } finally {
        if (!cancelled) {
          setHeatmapLoading(false);
        }
      }
    }

    void loadHeatmap();

    return () => {
      cancelled = true;
    };
  }, [params.id, selectedMonth]);

  const documents = useMemo(() => {
    if (!profile || !Array.isArray(profile.document_urls)) {
      return [] as Array<{ url: string; type: string; label?: string; uploadedAt?: string }>;
    }

    return profile.document_urls as Array<{ url: string; type: string; label?: string; uploadedAt?: string }>;
  }, [profile]);

  const heatmapCells = useMemo(() => {
    if (!heatmap) {
      return [] as Array<{ key: string; dayOfMonth: number; status: HeatmapStatus; date: string }>;
    }

    const firstDayOfWeek = heatmap.days[0]?.dayOfWeek ?? 0;
    const leading = Array.from({ length: firstDayOfWeek }).map((_, index) => ({
      key: `leading-${index}`,
      dayOfMonth: 0,
      status: null as HeatmapStatus,
      date: '',
    }));

    const dayCells = heatmap.days.map((day) => ({
      key: day.date,
      dayOfMonth: day.dayOfMonth,
      status: day.status,
      date: day.date,
    }));

    return [...leading, ...dayCells];
  }, [heatmap]);

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError('');
    setMessage('');

    try {
      await uploadStudentPhoto(params.id, file);
      setMessage('Photo uploaded successfully.');
      await loadProfile();
    } catch (uploadError) {
      const messageText = uploadError instanceof Error ? uploadError.message : 'Photo upload failed';
      setError(messageText);
    }
  }

  async function handleDocumentUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError('');
    setMessage('');

    try {
      await uploadStudentDocument(params.id, file, { type: 'other' });
      setMessage('Document uploaded successfully.');
      await loadProfile();
    } catch (uploadError) {
      const messageText = uploadError instanceof Error ? uploadError.message : 'Document upload failed';
      setError(messageText);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading student profile...</p>;
  }

  if (error && !profile) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!profile) {
    return <p className="text-sm text-slate-600">Student profile unavailable.</p>;
  }

  return (
    <section className="space-y-5">
      <header className="rounded-lg bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">{profile.name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {profile.student_code} • Class {profile.class_grade} • {profile.status}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Personal Details</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            <li>Phone: {profile.phone || '-'}</li>
            <li>School/College: {profile.school_college || '-'}</li>
            <li>Address: {profile.address || '-'}</li>
          </ul>
          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium">Upload Photo</label>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} />
            {profile.photo_url ? (
              <a href={profile.photo_url} className="block text-sm text-slate-700 underline" target="_blank" rel="noreferrer">
                View current photo
              </a>
            ) : null}
          </div>
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Enrollment & Fees</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            <li>Enrollment Date: {new Date(profile.enrollment_date).toLocaleDateString('en-IN')}</li>
            <li>Total Fee Due: ₹{profile.feeSummary.totalAmountDue / 100}</li>
            <li>Pending Fee: ₹{profile.feeSummary.pendingAmount / 100}</li>
            <li>Attendance: {profile.attendanceSummary.attendancePercent}%</li>
          </ul>
          {profile.attendanceSummary.lowAttendanceAlert ? (
            <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Low attendance alert: below 75%
            </p>
          ) : null}
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Enrolled Batches</h2>
          {profile.batch_students.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Not enrolled in any batch yet.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {profile.batch_students.map((row) => (
                <li key={row.batch.id}>
                  {row.batch.name} ({row.batch.subject})
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Test History</h2>
          {profile.test_results.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No test records yet.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {profile.test_results.map((result) => (
                <li key={result.id}>
                  {result.test.title} • {result.test.subject} • {result.percentage ?? '-'}%
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <article className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Documents</h2>
        <div className="mt-3 space-y-2">
          <label className="block text-sm font-medium">Upload Document</label>
          <input type="file" accept=".pdf,image/*,.docx" onChange={handleDocumentUpload} />
        </div>

        {documents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No documents uploaded yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {documents.map((doc, index) => (
              <li key={`${doc.url}-${index}`}>
                <a href={doc.url} className="underline" target="_blank" rel="noreferrer">
                  {doc.label || doc.type || `Document ${index + 1}`}
                </a>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="rounded-lg bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Attendance Calendar</h2>
          <label className="text-sm text-slate-700">
            Month{' '}
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
        </div>

        <p className="mt-2 text-sm text-slate-600">{monthLabel(selectedMonth)}</p>

        {heatmapLoading ? <p className="mt-3 text-sm text-slate-600">Loading attendance calendar...</p> : null}
        {heatmapError ? <p className="mt-3 text-sm text-red-600">{heatmapError}</p> : null}

        {heatmap && !heatmapLoading ? (
          <>
            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {heatmapCells.map((cell) => (
                <div
                  key={cell.key}
                  title={cell.date ? `${cell.date} • ${cell.status ?? 'unmarked'}` : ''}
                  className={`h-10 rounded-md text-center text-xs font-semibold leading-10 ${
                    cell.dayOfMonth === 0 ? 'bg-transparent' : `${statusClass(cell.status)} text-white`
                  }`}
                >
                  {cell.dayOfMonth === 0 ? '' : cell.dayOfMonth}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              {([
                ['present', 'Present'],
                ['absent', 'Absent'],
                ['late', 'Late'],
                ['holiday', 'Holiday'],
                ['cancelled', 'Cancelled'],
                [null, 'Unmarked'],
              ] as Array<[HeatmapStatus, string]>).map(([status, label]) => (
                <span key={label} className="inline-flex items-center gap-2 rounded border border-slate-200 px-2 py-1">
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded ${statusClass(status)} text-[10px] text-white`}>
                    {shortStatus(status)}
                  </span>
                  {label}
                </span>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-600">
              Marked: {heatmap.summary.markedDays} • Present: {heatmap.summary.present} • Absent: {heatmap.summary.absent} • Late:{' '}
              {heatmap.summary.late} • Holiday: {heatmap.summary.holiday}
            </p>
          </>
        ) : null}
      </article>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
