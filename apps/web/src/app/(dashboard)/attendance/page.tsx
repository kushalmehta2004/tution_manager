'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchAttendanceForBatchDate,
  fetchBatches,
  upsertAttendance,
  type AttendanceStatus,
  type BatchListItem,
  type BatchAttendanceStudent,
} from '../../../lib/api';

type RowState = {
  studentId: string;
  studentCode: string;
  name: string;
  profileStatus: 'active' | 'inactive' | 'trial' | 'alumni';
  status: AttendanceStatus;
  note: string;
};

const statusOptions: AttendanceStatus[] = ['present', 'absent', 'late'];

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(todayString());
  const [rows, setRows] = useState<RowState[]>([]);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetchBatches();
        setBatches(response.data);
      } catch (requestError) {
        const messageText = requestError instanceof Error ? requestError.message : 'Failed to load batches';
        setError(messageText);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedBatchId || !selectedDate) {
      setRows([]);
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    void (async () => {
      try {
        const response = await fetchAttendanceForBatchDate({
          batchId: selectedBatchId,
          date: selectedDate,
        });

        setMode(response.mode);
        setRows(
          response.students.map((student: BatchAttendanceStudent) => ({
            studentId: student.studentId,
            studentCode: student.studentCode,
            name: student.name,
            profileStatus: student.profileStatus,
            status: student.status ?? 'absent',
            note: student.note ?? '',
          })),
        );
      } catch (requestError) {
        const messageText =
          requestError instanceof Error ? requestError.message : 'Failed to fetch attendance';
        setError(messageText);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedBatchId, selectedDate]);

  const hasStudents = rows.length > 0;

  const summary = useMemo(() => {
    return rows.reduce(
      (accumulator, row) => {
        accumulator[row.status] += 1;
        return accumulator;
      },
      { present: 0, absent: 0, late: 0 },
    );
  }, [rows]);

  function updateRowStatus(studentId: string, status: AttendanceStatus) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.studentId === studentId ? { ...row, status } : row)),
    );
  }

  function updateRowNote(studentId: string, note: string) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.studentId === studentId ? { ...row, note } : row)),
    );
  }

  function markAllPresent() {
    setRows((currentRows) => currentRows.map((row) => ({ ...row, status: 'present' })));
  }

  async function submitAttendance() {
    if (!selectedBatchId || !selectedDate || rows.length === 0) {
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const result = await upsertAttendance({
        batchId: selectedBatchId,
        date: selectedDate,
        entries: rows.map((row) => ({
          studentId: row.studentId,
          status: row.status,
          note: row.note.trim() || undefined,
        })),
      });

      setMode('edit');
      setMessage(
        `Attendance saved (${result.summary.submitted} records: ${result.summary.created} created, ${result.summary.updated} updated).`,
      );
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : 'Failed to save attendance';
      setError(messageText);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <header className="rounded-lg bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Attendance</h1>
        <p className="mt-1 text-sm text-slate-600">
          One-tap attendance for each batch with present, absent, and late status.
        </p>
      </header>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Batch</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={selectedBatchId}
              onChange={(event) => setSelectedBatchId(event.target.value)}
            >
              <option value="">Select batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Date</label>
            <input
              type="date"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
              onClick={markAllPresent}
              disabled={!hasStudents || loading || saving}
            >
              Mark All Present
            </button>
          </div>
        </div>

        {loading ? <p className="mt-3 text-sm text-slate-600">Loading attendance...</p> : null}

        {!loading && selectedBatchId && hasStudents ? (
          <>
            <p className="mt-3 text-xs text-slate-500">
              {mode === 'edit'
                ? 'Attendance already exists for this date. You are in edit mode.'
                : 'No attendance found for this date. You are creating new records.'}
            </p>

            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.studentId} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{row.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{row.profileStatus}</p>
                      </td>
                      <td className="px-4 py-3">{row.studentCode}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {statusOptions.map((status) => (
                            <button
                              key={`${row.studentId}-${status}`}
                              type="button"
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                                row.status === status
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-300 bg-white text-slate-700'
                              }`}
                              onClick={() => updateRowStatus(row.studentId, status)}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                          placeholder="Optional note"
                          value={row.note}
                          onChange={(event) => updateRowNote(row.studentId, event.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={submitAttendance}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Submit Attendance'}
              </button>
              <p className="text-sm text-slate-600">
                Present: {summary.present} • Absent: {summary.absent} • Late: {summary.late}
              </p>
            </div>
          </>
        ) : null}

        {!loading && selectedBatchId && !hasStudents ? (
          <p className="mt-3 text-sm text-slate-600">No active students found in this batch.</p>
        ) : null}

        {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>
    </section>
  );
}
