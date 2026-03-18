'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createBatch,
  createHoliday,
  fetchBatchRoster,
  fetchBatches,
  fetchHolidays,
  type BatchListItem,
  type HolidayItem,
} from '../../../lib/api';

const weekdays = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const batchSchema = z.object({
  name: z.string().trim().min(2),
  subject: z.string().trim().min(2),
  assignedFacultyId: z.string().uuid().optional().or(z.literal('')),
  capacity: z.coerce.number().int().positive(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  room: z.string().trim().optional(),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1),
});

const holidaySchema = z.object({
  date: z.string().min(1),
  title: z.string().trim().min(2),
  batchId: z.string().optional(),
});

type BatchFormData = z.infer<typeof batchSchema>;
type HolidayFormData = z.infer<typeof holidaySchema>;

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [roster, setRoster] = useState<
    Array<{ studentId: string; studentCode: string; name: string; attendancePercent: number }>
  >([]);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      academicYear: '2026-27',
      colorHex: '#2563EB',
      daysOfWeek: [1, 3, 5],
    },
  });

  const {
    register: registerHoliday,
    handleSubmit: handleHolidaySubmit,
    reset: resetHoliday,
    formState: { isSubmitting: isHolidaySubmitting },
  } = useForm<HolidayFormData>({
    resolver: zodResolver(holidaySchema),
  });

  const selectedDays = watch('daysOfWeek');

  async function loadData() {
    setError('');

    try {
      const [batchResponse, holidayResponse] = await Promise.all([fetchBatches(), fetchHolidays()]);
      setBatches(batchResponse.data);
      setHolidays(holidayResponse.data);
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : 'Failed to load batches';
      setError(messageText);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!selectedBatchId) {
      setRoster([]);
      return;
    }

    void (async () => {
      try {
        const response = await fetchBatchRoster(selectedBatchId);
        setRoster(
          response.students.map((row) => ({
            studentId: row.studentId,
            studentCode: row.studentCode,
            name: row.name,
            attendancePercent: row.attendancePercent,
          })),
        );
      } catch {
        setRoster([]);
      }
    })();
  }, [selectedBatchId]);

  const timetableByDay = useMemo(() => {
    return weekdays.map((day) => ({
      ...day,
      rows: batches.filter((batch) => batch.days_of_week.includes(day.value)),
    }));
  }, [batches]);

  async function onSubmit(values: BatchFormData) {
    setError('');
    setMessage('');

    try {
      await createBatch({
        name: values.name,
        subject: values.subject,
        assignedFacultyId: values.assignedFacultyId || undefined,
        capacity: values.capacity,
        daysOfWeek: values.daysOfWeek,
        startTime: values.startTime,
        endTime: values.endTime,
        room: values.room || undefined,
        academicYear: values.academicYear,
        colorHex: values.colorHex,
      });

      setMessage('Batch created successfully.');
      reset({
        academicYear: values.academicYear,
        colorHex: values.colorHex,
        daysOfWeek: values.daysOfWeek,
      });
      await loadData();
    } catch (submitError) {
      const messageText = submitError instanceof Error ? submitError.message : 'Failed to create batch';
      setError(messageText);
    }
  }

  async function onHolidaySubmit(values: HolidayFormData) {
    setError('');
    setMessage('');

    try {
      await createHoliday({
        date: values.date,
        title: values.title,
        batchId: values.batchId || undefined,
      });

      setMessage('Holiday marked successfully. Attendance can skip this date.');
      resetHoliday();
      await loadData();
    } catch (submitError) {
      const messageText = submitError instanceof Error ? submitError.message : 'Failed to save holiday';
      setError(messageText);
    }
  }

  return (
    <section className="space-y-5">
      <header className="rounded-lg bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Batches & Schedule</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create batches, manage weekly timetable, and set holidays.
        </p>
      </header>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">New Batch</h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium">Batch Name</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('name')} />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Subject</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('subject')} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Assigned Faculty ID (optional)</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              {...register('assignedFacultyId')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Capacity</label>
            <input
              type="number"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              {...register('capacity')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Academic Year</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('academicYear')} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Start Time</label>
            <input type="time" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('startTime')} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">End Time</label>
            <input type="time" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('endTime')} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Room</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('room')} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Color</label>
            <input type="color" className="h-10 w-full rounded-md border border-slate-300" {...register('colorHex')} />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Days of Week</label>
            <div className="flex flex-wrap gap-2">
              {weekdays.map((day) => {
                const checked = selectedDays?.includes(day.value) ?? false;

                return (
                  <button
                    key={day.value}
                    type="button"
                    className={`rounded-md border px-3 py-1 text-sm ${
                      checked
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    onClick={() => {
                      const current = new Set(selectedDays ?? []);

                      if (current.has(day.value)) {
                        current.delete(day.value);
                      } else {
                        current.add(day.value);
                      }

                      setValue('daysOfWeek', Array.from(current).sort((a, b) => a - b), {
                        shouldValidate: true,
                      });
                    }}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            {errors.daysOfWeek ? (
              <p className="mt-1 text-xs text-red-600">Select at least one day.</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Create Batch'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Weekly Timetable</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-7">
          {timetableByDay.map((day) => (
            <article key={day.value} className="rounded-md border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-800">{day.label}</h3>
              {day.rows.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">No class</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {day.rows.map((batch) => (
                    <li
                      key={`${day.value}-${batch.id}`}
                      className="rounded px-2 py-1 text-xs text-white"
                      style={{ backgroundColor: batch.color_hex ?? '#334155' }}
                    >
                      <p className="font-semibold">{batch.name}</p>
                      <p>
                        {formatTime(batch.start_time)} - {formatTime(batch.end_time)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Holidays</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-3" onSubmit={handleHolidaySubmit(onHolidaySubmit)}>
          <input type="date" className="rounded-md border border-slate-300 px-3 py-2" {...registerHoliday('date')} />
          <input
            placeholder="Holiday title"
            className="rounded-md border border-slate-300 px-3 py-2"
            {...registerHoliday('title')}
          />
          <select className="rounded-md border border-slate-300 px-3 py-2" {...registerHoliday('batchId')}>
            <option value="">All batches</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={isHolidaySubmitting}
            >
              {isHolidaySubmitting ? 'Saving...' : 'Mark Holiday'}
            </button>
          </div>
        </form>

        <ul className="mt-4 space-y-1 text-sm text-slate-700">
          {holidays.map((holiday) => (
            <li key={holiday.id}>
              {new Date(holiday.date).toLocaleDateString('en-IN')} • {holiday.title}
              {holiday.batch ? ` • ${holiday.batch.name}` : ' • All batches'}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Batch List</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {batches.map((batch) => (
            <article key={batch.id} className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-base font-semibold">{batch.name}</h3>
              <p className="text-sm text-slate-600">{batch.subject}</p>
              <p className="mt-1 text-sm text-slate-700">
                Occupancy: {batch.activeStudentCount}/{batch.capacity} ({batch.occupancyPercent}%)
              </p>
              {batch.capacityAlert ? (
                <p className="mt-1 text-xs font-medium text-amber-700">Capacity warning: 90% or more filled</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Batch Roster</h2>
        <div className="mt-3 max-w-md">
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

        {selectedBatchId ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((student) => (
                  <tr key={student.studentId} className="border-t border-slate-100">
                    <td className="px-4 py-3">{student.name}</td>
                    <td className="px-4 py-3">{student.studentCode}</td>
                    <td className="px-4 py-3">{student.attendancePercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Select a batch to view roster attendance.</p>
        )}
      </section>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
