'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  enrollStudent,
  fetchFeeStructures,
  fetchStudents,
  sendParentInvite,
  type FeeStructureSummary,
  type StudentListItem,
} from '../../../lib/api';

const enrollmentSchema = z.object({
  name: z.string().trim().min(2),
  phone: z
    .string()
    .trim()
    .max(15)
    .refine((value) => value === '' || value.length >= 10, { message: 'Enter a valid phone' }),
  classGrade: z.string().trim().min(1),
  schoolCollege: z.string().trim().max(255),
  enrollmentDate: z.string().min(1),
  status: z.enum(['active', 'trial']),
  feeStructureId: z.string().uuid(),
  parentName: z.string().trim().min(2),
  parentPhone: z.string().trim().min(10).max(15),
  relation: z.enum(['father', 'mother', 'guardian']),
  channel: z.literal('whatsapp'),
});

type EnrollmentFormData = z.infer<typeof enrollmentSchema>;

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructureSummary[]>([]);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EnrollmentFormData>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      status: 'active',
      relation: 'father',
      channel: 'whatsapp',
      enrollmentDate: new Date().toISOString().slice(0, 10),
      phone: '',
      schoolCollege: '',
    },
    mode: 'onSubmit',
  });

  const trialStudents = useMemo(
    () => students.filter((student) => student.status === 'trial'),
    [students],
  );

  async function loadInitialData() {
    setLoading(true);
    setError('');

    try {
      const [studentResponse, feeResponse] = await Promise.all([fetchStudents(), fetchFeeStructures()]);

      setStudents(studentResponse.data);
      setFeeStructures(feeResponse);
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : 'Failed to load data';
      setError(messageText);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function onSubmit(values: EnrollmentFormData) {
    setError('');
    setMessage('');

    try {
      const result = (await enrollStudent({
        name: values.name,
        phone: values.phone || undefined,
        classGrade: values.classGrade,
        schoolCollege: values.schoolCollege || undefined,
        enrollmentDate: values.enrollmentDate,
        status: values.status,
        feeStructureId: values.feeStructureId,
      })) as { student: { id: string } };

      await sendParentInvite(result.student.id, {
        parentName: values.parentName,
        parentPhone: values.parentPhone,
        relation: values.relation,
        channel: values.channel,
      });

      setMessage('Student enrolled, fee schedule generated, and parent invite sent.');
      reset({
        status: 'active',
        relation: 'father',
        channel: 'whatsapp',
        enrollmentDate: new Date().toISOString().slice(0, 10),
      });
      await loadInitialData();
    } catch (submitError) {
      const messageText = submitError instanceof Error ? submitError.message : 'Enrollment failed';
      setError(messageText);
    }
  }

  return (
    <section className="space-y-5">
      <header className="rounded-lg bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Students & Enrollment</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enroll students with fee structure assignment and parent invite.
        </p>
      </header>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">New Enrollment</h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium">Student Name</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('name')} />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Phone (optional)</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('phone')} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Class / Grade</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('classGrade')} />
            {errors.classGrade ? <p className="mt-1 text-xs text-red-600">{errors.classGrade.message}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">School / College</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              {...register('schoolCollege')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Enrollment Date</label>
            <input
              type="date"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              {...register('enrollmentDate')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('status')}>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Fee Structure</label>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('feeStructureId')}>
              <option value="">Select fee structure</option>
              {feeStructures.map((structure) => (
                <option key={structure.id} value={structure.id}>
                  {structure.name} • ₹{Math.round(structure.amount / 100)} • {structure.frequency}
                </option>
              ))}
            </select>
            {errors.feeStructureId ? (
              <p className="mt-1 text-xs text-red-600">Fee structure is required.</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Parent Name</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('parentName')} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Parent Phone</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('parentPhone')} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Relation</label>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('relation')}>
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="guardian">Guardian</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Invite Channel</label>
            <input
              className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700"
              value="WhatsApp"
              readOnly
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enrolling...' : 'Enroll Student'}
            </button>
          </div>
        </form>

        {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">All Students</h2>
        {loading ? <p className="mt-3 text-sm text-slate-600">Loading students...</p> : null}

        {!loading ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link className="text-slate-900 hover:underline" href={`/students/${student.id}`}>
                        {student.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{student.student_code}</td>
                    <td className="px-4 py-3">{student.class_grade}</td>
                    <td className="px-4 py-3 capitalize">{student.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Trial Students</h2>
        {trialStudents.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No trial students currently.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {trialStudents.map((student) => (
              <li key={student.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                {student.name} ({student.student_code})
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
