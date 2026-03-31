'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createFeeStructure,
  fetchAnnualSummary,
  fetchDailyCollectionSummary,
  fetchMonthlyCollectionReport,
  fetchOutstandingFeesReport,
  fetchStudentLedger,
  fetchStudentFees,
  fetchFeeStructures,
  downloadAnnualSummaryReport,
  recordFeePayment,
  sendFeeReminder,
  type FeeStructureSummary,
  type StudentFeeListItem,
} from '../../../lib/api';

const frequencyOptions: Array<FeeStructureSummary['frequency']> = [
  'monthly',
  'quarterly',
  'half_yearly',
  'annual',
  'one_time',
  'per_class',
];

function formatRupeesFromPaise(value: number): string {
  return `INR ${(value / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FeesPage() {
  const [feeStructures, setFeeStructures] = useState<FeeStructureSummary[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFeeListItem[]>([]);
  const [dailySummary, setDailySummary] = useState<{
    totalCollected: number;
    paymentCount: number;
    byMode: Record<string, number>;
  } | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<{
    month: string;
    expectedTotal: number;
    collectedTotal: number;
    pendingTotal: number;
    byMode: Record<string, number>;
  } | null>(null);
  const [outstandingReport, setOutstandingReport] = useState<{
    summary: { totalOutstanding: number; count: number; ageing: Record<string, number> };
  } | null>(null);
  const [annualSummary, setAnnualSummary] = useState<{
    financialYear: string;
    totalCollected: number;
    monthly: Array<{ month: string; total: number }>;
  } | null>(null);
  const [ledgerStudentId, setLedgerStudentId] = useState<string>('');
  const [ledger, setLedger] = useState<{
    student: { name: string; student_code: string };
    summary: { totalDue: number; totalPaid: number; pending: number };
  } | null>(null);

  const [statusFilter, setStatusFilter] = useState<'pending' | 'paid' | 'partial' | 'waived' | 'overdue' | ''>('');
  const [search, setSearch] = useState<string>('');
  const [selectedFeeId, setSelectedFeeId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(todayString());
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'razorpay' | 'other'>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');

  const [newName, setNewName] = useState<string>('');
  const [newAmount, setNewAmount] = useState<string>('');
  const [newFrequency, setNewFrequency] = useState<FeeStructureSummary['frequency']>('monthly');
  const [newSubject, setNewSubject] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const selectedFee = useMemo(
    () => studentFees.find((fee) => fee.id === selectedFeeId) ?? null,
    [selectedFeeId, studentFees],
  );

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [structures, fees, summary, monthly, outstanding, annual] = await Promise.all([
        fetchFeeStructures(),
        fetchStudentFees({
          status: statusFilter || undefined,
          search: search.trim() || undefined,
          pageSize: 50,
        }),
        fetchDailyCollectionSummary(todayString()),
        fetchMonthlyCollectionReport(),
        fetchOutstandingFeesReport(),
        fetchAnnualSummary(),
      ]);

      setFeeStructures(structures);
      setStudentFees(fees.data);
      setDailySummary(summary);
      setMonthlyReport(monthly);
      setOutstandingReport(outstanding);
      setAnnualSummary(annual);
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : 'Failed to load fee data';
      setError(messageText);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function onCreateFeeStructure(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await createFeeStructure({
        name: newName,
        amount: Math.round(Number(newAmount) * 100),
        frequency: newFrequency,
        subject: newSubject || undefined,
      });

      setMessage('Fee structure created.');
      setNewName('');
      setNewAmount('');
      setNewSubject('');
      await loadData();
    } catch (submitError) {
      const messageText = submitError instanceof Error ? submitError.message : 'Failed to create fee structure';
      setError(messageText);
    } finally {
      setSaving(false);
    }
  }

  async function onRecordPayment(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedFeeId) {
      setError('Select a student fee row first.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const result = await recordFeePayment({
        studentFeeId: selectedFeeId,
        amountPaid: Math.round(Number(amountPaid) * 100),
        paymentDate,
        paymentMode,
        referenceNumber: referenceNumber || undefined,
      });

      setMessage(
        `Payment saved. Remaining balance: ${formatRupeesFromPaise(result.studentFee.amountPending)}${
          result.payment.receiptUrl ? ' (receipt generated)' : ''
        }`,
      );

      setAmountPaid('');
      setReferenceNumber('');
      await loadData();
    } catch (submitError) {
      const messageText = submitError instanceof Error ? submitError.message : 'Failed to record payment';
      setError(messageText);
    } finally {
      setSaving(false);
    }
  }

  async function onSendReminder(studentFeeId: string) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await sendFeeReminder({ studentFeeId, channel: 'whatsapp' });
      setMessage('Reminder sent successfully.');
      await loadData();
    } catch (submitError) {
      const messageText = submitError instanceof Error ? submitError.message : 'Failed to send reminder';
      setError(messageText);
    } finally {
      setSaving(false);
    }
  }

  async function onLoadLedger(event: React.FormEvent) {
    event.preventDefault();
    if (!ledgerStudentId) {
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetchStudentLedger(ledgerStudentId);
      setLedger(response);
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : 'Failed to load student ledger';
      setError(messageText);
    } finally {
      setSaving(false);
    }
  }

  async function onDownloadAnnual(format: 'pdf' | 'excel') {
    if (!annualSummary) {
      return;
    }

    try {
      const blob = await downloadAnnualSummaryReport(format, annualSummary.financialYear);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `annual-fee-summary-${annualSummary.financialYear}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : 'Failed to download report';
      setError(messageText);
    }
  }

  return (
    <section className="space-y-5">
      <header className="rounded-lg bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Fees & Collections</h1>
        <p className="mt-1 text-sm text-slate-600">Manage fee structures, track pending dues, and record payments.</p>
      </header>

      {dailySummary ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Today&apos;s Collection</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatRupeesFromPaise(dailySummary.totalCollected)}
            </p>
          </article>
          <article className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Payments Recorded</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{dailySummary.paymentCount}</p>
          </article>
          <article className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">UPI</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatRupeesFromPaise(dailySummary.byMode.upi ?? 0)}</p>
          </article>
          <article className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Cash</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatRupeesFromPaise(dailySummary.byMode.cash ?? 0)}</p>
          </article>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Create Fee Structure</h2>
          <form className="mt-4 grid gap-3" onSubmit={onCreateFeeStructure}>
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Structure name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              required
            />
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              type="number"
              min="1"
              step="0.01"
              placeholder="Amount in INR"
              value={newAmount}
              onChange={(event) => setNewAmount(event.target.value)}
              required
            />
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={newFrequency}
              onChange={(event) => setNewFrequency(event.target.value as FeeStructureSummary['frequency'])}
            >
              {frequencyOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Subject (optional)"
              value={newSubject}
              onChange={(event) => setNewSubject(event.target.value)}
            />
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Create Structure'}
            </button>
          </form>

          <ul className="mt-4 space-y-1 text-sm text-slate-700">
            {feeStructures.map((structure) => (
              <li key={structure.id} className="rounded border border-slate-200 px-3 py-2">
                <p className="font-medium text-slate-900">{structure.name}</p>
                <p>
                  {formatRupeesFromPaise(structure.amount)} • {structure.frequency}
                  {structure.subject ? ` • ${structure.subject}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Record Payment</h2>
          <form className="mt-4 grid gap-3" onSubmit={onRecordPayment}>
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={selectedFeeId}
              onChange={(event) => setSelectedFeeId(event.target.value)}
              required
            >
              <option value="">Select pending fee</option>
              {studentFees
                .filter((fee) => fee.amountPending > 0)
                .map((fee) => (
                  <option key={fee.id} value={fee.id}>
                    {fee.student.name} ({fee.student.student_code}) • Due {new Date(fee.dueDate).toLocaleDateString('en-IN')} • Pending{' '}
                    {formatRupeesFromPaise(fee.amountPending)}
                  </option>
                ))}
            </select>

            {selectedFee ? (
              <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Selected: {selectedFee.student.name} • Pending {formatRupeesFromPaise(selectedFee.amountPending)}
              </p>
            ) : null}

            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              type="number"
              min="1"
              step="0.01"
              placeholder="Amount paid in INR"
              value={amountPaid}
              onChange={(event) => setAmountPaid(event.target.value)}
              required
            />

            <input
              type="date"
              className="rounded-md border border-slate-300 px-3 py-2"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              required
            />

            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value as typeof paymentMode)}
            >
              <option value="cash">cash</option>
              <option value="upi">upi</option>
              <option value="bank_transfer">bank_transfer</option>
              <option value="cheque">cheque</option>
              <option value="razorpay">razorpay</option>
              <option value="other">other</option>
            </select>

            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Reference number (optional)"
              value={referenceNumber}
              onChange={(event) => setReferenceNumber(event.target.value)}
            />

            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </form>
        </article>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Student Fees</h2>
          <select
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="">All status</option>
            <option value="pending">pending</option>
            <option value="partial">partial</option>
            <option value="overdue">overdue</option>
            <option value="paid">paid</option>
            <option value="waived">waived</option>
          </select>
          <input
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Search student"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            onClick={() => void loadData()}
          >
            Apply
          </button>
        </div>

        {loading ? <p className="mt-3 text-sm text-slate-600">Loading fee rows...</p> : null}

        {!loading ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Structure</th>
                  <th className="px-4 py-3 font-medium">Due Date</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Pending</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentFees.map((fee) => (
                  <tr key={fee.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      {fee.student.name}
                      <p className="text-xs text-slate-500">{fee.student.student_code}</p>
                    </td>
                    <td className="px-4 py-3">{fee.feeStructure.name}</td>
                    <td className="px-4 py-3">{new Date(fee.dueDate).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">{formatRupeesFromPaise(fee.amountDue)}</td>
                    <td className="px-4 py-3">{formatRupeesFromPaise(fee.amountPaid)}</td>
                    <td className="px-4 py-3">{formatRupeesFromPaise(fee.amountPending)}</td>
                    <td className="px-4 py-3 capitalize">{fee.status}</td>
                    <td className="px-4 py-3">
                      {fee.amountPending > 0 ? (
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                          onClick={() => void onSendReminder(fee.id)}
                          disabled={saving}
                        >
                          Send Reminder
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold">Monthly Report</h3>
          {monthlyReport ? (
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              <li>Month: {monthlyReport.month}</li>
              <li>Expected: {formatRupeesFromPaise(monthlyReport.expectedTotal)}</li>
              <li>Collected: {formatRupeesFromPaise(monthlyReport.collectedTotal)}</li>
              <li>Pending: {formatRupeesFromPaise(monthlyReport.pendingTotal)}</li>
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No monthly report data.</p>
          )}
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold">Outstanding Ageing</h3>
          {outstandingReport ? (
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              <li>Total Outstanding: {formatRupeesFromPaise(outstandingReport.summary.totalOutstanding)}</li>
              <li>Count: {outstandingReport.summary.count}</li>
              <li>0-30: {formatRupeesFromPaise(outstandingReport.summary.ageing['0-30'] ?? 0)}</li>
              <li>31-60: {formatRupeesFromPaise(outstandingReport.summary.ageing['31-60'] ?? 0)}</li>
              <li>61-90: {formatRupeesFromPaise(outstandingReport.summary.ageing['61-90'] ?? 0)}</li>
              <li>90+: {formatRupeesFromPaise(outstandingReport.summary.ageing['90+'] ?? 0)}</li>
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No outstanding report data.</p>
          )}
        </article>

        <article className="rounded-lg bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold">Annual Summary</h3>
          {annualSummary ? (
            <>
              <p className="mt-3 text-sm text-slate-700">FY {annualSummary.financialYear}</p>
              <p className="text-sm text-slate-700">Collected: {formatRupeesFromPaise(annualSummary.totalCollected)}</p>
              <button
                type="button"
                className="mt-3 inline-block rounded border border-slate-300 px-3 py-1.5 text-xs"
                onClick={() => void onDownloadAnnual('pdf')}
              >
                Export PDF (API)
              </button>
              <button
                type="button"
                className="mt-2 ml-2 inline-block rounded border border-slate-300 px-3 py-1.5 text-xs"
                onClick={() => void onDownloadAnnual('excel')}
              >
                Export Excel (API)
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No annual summary data.</p>
          )}
        </article>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold">Student Ledger</h3>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={onLoadLedger}>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={ledgerStudentId}
            onChange={(event) => setLedgerStudentId(event.target.value)}
          >
            <option value="">Select student</option>
            {Array.from(new Map(studentFees.map((fee) => [fee.student.id, fee.student])).values()).map((student) => (
              <option key={student.id} value={student.id}>
                {student.name} ({student.student_code})
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={saving}>
            Load Ledger
          </button>
        </form>

        {ledger ? (
          <div className="mt-3 text-sm text-slate-700">
            <p className="font-medium">
              {ledger.student.name} ({ledger.student.student_code})
            </p>
            <p>Total Due: {formatRupeesFromPaise(ledger.summary.totalDue)}</p>
            <p>Total Paid: {formatRupeesFromPaise(ledger.summary.totalPaid)}</p>
            <p>Pending: {formatRupeesFromPaise(ledger.summary.pending)}</p>
          </div>
        ) : null}
      </section>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
