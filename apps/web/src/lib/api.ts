export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

export type FeeStructureSummary = {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'half_yearly' | 'annual' | 'one_time' | 'per_class';
  subject: string | null;
  description?: string | null;
  is_active?: boolean;
};

export type StudentFeeListItem = {
  id: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  amountPending: number;
  discountAmount: number;
  discountReason: string | null;
  status: 'pending' | 'paid' | 'partial' | 'waived' | 'overdue';
  periodLabel: string | null;
  student: {
    id: string;
    name: string;
    student_code: string;
  };
  feeStructure: {
    id: string;
    name: string;
    frequency: string;
    subject: string | null;
  };
};

export type DailyCollectionSummary = {
  date: string;
  totalCollected: number;
  paymentCount: number;
  byMode: {
    cash: number;
    upi: number;
    bank_transfer: number;
    cheque: number;
    razorpay: number;
    other: number;
  };
};

export type StudentListItem = {
  id: string;
  student_code: string;
  name: string;
  class_grade: string;
  status: 'active' | 'inactive' | 'trial' | 'alumni';
  phone: string | null;
};

export type BatchListItem = {
  id: string;
  name: string;
  subject: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  room: string | null;
  capacity: number;
  academic_year: string;
  color_hex: string | null;
  activeStudentCount: number;
  occupancyPercent: number;
  capacityAlert: boolean;
};

export type HolidayItem = {
  id: string;
  date: string;
  title: string;
  batch: { id: string; name: string } | null;
};

export type AttendanceStatus = 'present' | 'absent' | 'late';

export type BatchAttendanceStudent = {
  studentId: string;
  studentCode: string;
  name: string;
  profileStatus: 'active' | 'inactive' | 'trial' | 'alumni';
  status: AttendanceStatus | null;
  note: string | null;
  markedAt: string | null;
};

export type BatchAttendanceResponse = {
  batch: { id: string; name: string; subject: string };
  date: string;
  mode: 'create' | 'edit';
  students: BatchAttendanceStudent[];
};

export type DashboardSummary = {
  kpis: {
    studentsEnrolled: number;
    activeBatches: number;
    trialStudents: number;
    pendingFees: number;
    todayAttendance: {
      present: number;
      absent: number;
      late: number;
      totalMarked: number;
    };
    lowAttendanceCount: number;
  };
  overdueFees: Array<{
    studentFeeId: string;
    studentId: string;
    studentName: string;
    studentCode: string;
    amountDue: number;
    dueDate: string;
  }>;
  upcomingClasses: Array<{
    batchId: string;
    batchName: string;
    subject: string;
    classDate: string;
    startTime: string;
    endTime: string;
    room: string | null;
  }>;
  monthlyRevenue: Array<{
    month: string;
    totalCollected: number;
  }>;
  lowAttendanceAlerts: Array<{
    studentId: string;
    studentName: string;
    studentCode: string;
    attendancePercent: number;
  }>;
  feeProgress: {
    month: string;
    expectedThisMonth: number;
    collectedThisMonth: number;
    progressPercent: number;
  };
};

export type StudentAttendanceHeatmap = {
  student: {
    id: string;
    studentCode: string;
    name: string;
  };
  month: string;
  monthStart: string;
  monthEnd: string;
  days: Array<{
    date: string;
    dayOfMonth: number;
    dayOfWeek: number;
    status: 'present' | 'absent' | 'late' | 'holiday' | 'cancelled' | null;
  }>;
  summary: {
    markedDays: number;
    present: number;
    absent: number;
    late: number;
    holiday: number;
    cancelled: number;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem('tm_access_token');
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function clearToken(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('tm_access_token');
  }
}

export async function loginTeacher(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Login failed');
  }

  const data = (await response.json()) as LoginResponse;
  
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('tm_access_token', data.accessToken);
  }
  
  return data;
}

export async function fetchStudents(params?: { status?: string }) {
  const query = new URLSearchParams();

  if (params?.status) {
    query.set('status', params.status);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiRequest<{
    data: StudentListItem[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>(`/students${suffix}`);
}

export async function fetchStudentById(studentId: string) {
  return apiRequest<{
    id: string;
    student_code: string;
    name: string;
    phone: string | null;
    class_grade: string;
    school_college: string | null;
    address: string | null;
    photo_url: string | null;
    document_urls: unknown;
    status: 'active' | 'inactive' | 'trial' | 'alumni';
    enrollment_date: string;
    batch_students: Array<{ batch: { id: string; name: string; subject: string } }>;
    feeSummary: { totalAmountDue: number; pendingAmount: number };
    attendanceSummary: {
      present: number;
      absent: number;
      late: number;
      holiday: number;
      totalMarked: number;
      attendancePercent: number;
      lowAttendanceAlert: boolean;
    };
    test_results: Array<{
      id: string;
      percentage: string | null;
      test: { id: string; title: string; subject: string; test_date: string };
    }>;
  }>(`/students/${studentId}`);
}

export async function fetchStudentAttendanceHeatmap(studentId: string, month?: string) {
  const query = new URLSearchParams();

  if (month) {
    query.set('month', month);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<StudentAttendanceHeatmap>(`/students/${studentId}/attendance-heatmap${suffix}`);
}

export async function fetchFeeStructures() {
  const result = await apiRequest<{ data: FeeStructureSummary[] }>('/fee-structures');
  return result.data;
}

export async function createFeeStructure(payload: {
  name: string;
  amount: number;
  frequency: FeeStructureSummary['frequency'];
  subject?: string;
  description?: string;
  isActive?: boolean;
}) {
  return apiRequest<FeeStructureSummary>('/fee-structures', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function updateFeeStructure(
  feeStructureId: string,
  payload: Partial<{
    name: string;
    amount: number;
    frequency: FeeStructureSummary['frequency'];
    subject: string;
    description: string;
    isActive: boolean;
  }>,
) {
  return apiRequest<FeeStructureSummary>(`/fee-structures/${feeStructureId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchStudentFees(params?: {
  page?: number;
  pageSize?: number;
  status?: 'pending' | 'paid' | 'partial' | 'waived' | 'overdue';
  search?: string;
}) {
  const query = new URLSearchParams();

  if (params?.page) {
    query.set('page', String(params.page));
  }

  if (params?.pageSize) {
    query.set('pageSize', String(params.pageSize));
  }

  if (params?.status) {
    query.set('status', params.status);
  }

  if (params?.search) {
    query.set('search', params.search);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<{
    data: StudentFeeListItem[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>(`/fees/student-fees${suffix}`);
}

export async function recordFeePayment(payload: {
  studentFeeId: string;
  amountPaid: number;
  paymentDate?: string;
  paymentMode: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'razorpay' | 'other';
  referenceNumber?: string;
  notes?: string;
}) {
  return apiRequest<{
    payment: {
      id: string;
      amountPaid: number;
      paymentDate: string;
      paymentMode: string;
      referenceNumber: string | null;
      receiptNumber: string | null;
      receiptUrl: string | null;
    };
    studentFee: {
      id: string;
      status: string;
      amountDue: number;
      amountPaid: number;
      amountPending: number;
    };
  }>('/fees/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchDailyCollectionSummary(date?: string) {
  const query = new URLSearchParams();

  if (date) {
    query.set('date', date);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<DailyCollectionSummary>(`/fees/summary/daily${suffix}`);
}

export async function sendFeeReminder(payload: {
  studentFeeId: string;
  channel?: 'whatsapp';
  messageTemplate?: string;
}) {
  return apiRequest('/fees/reminders/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchMonthlyCollectionReport(month?: string) {
  const query = new URLSearchParams();
  if (month) {
    query.set('month', month);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<{
    month: string;
    expectedTotal: number;
    collectedTotal: number;
    pendingTotal: number;
    byMode: DailyCollectionSummary['byMode'];
  }>(`/fees/reports/monthly${suffix}`);
}

export async function fetchOutstandingFeesReport(asOfDate?: string) {
  const query = new URLSearchParams();
  if (asOfDate) {
    query.set('asOfDate', asOfDate);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<{
    asOfDate: string;
    summary: {
      totalOutstanding: number;
      count: number;
      ageing: Record<'0-30' | '31-60' | '61-90' | '90+', number>;
    };
    rows: Array<{
      studentFeeId: string;
      studentId: string;
      studentName: string;
      studentCode: string;
      dueDate: string;
      amountPending: number;
      overdueDays: number;
      bucket: '0-30' | '31-60' | '61-90' | '90+';
    }>;
  }>(`/fees/reports/outstanding${suffix}`);
}

export async function fetchStudentLedger(studentId: string) {
  const query = new URLSearchParams({ studentId });
  return apiRequest<{
    student: { id: string; name: string; student_code: string };
    summary: { totalDue: number; totalPaid: number; pending: number };
    fees: Array<{ id: string; dueDate: string; amountDue: number; status: string; periodLabel: string | null }>;
    payments: Array<{ id: string; amountPaid: number; paymentDate: string; paymentMode: string; receiptUrl: string | null }>;
  }>(`/fees/reports/student-ledger?${query.toString()}`);
}

export async function fetchAnnualSummary(financialYear?: string) {
  const query = new URLSearchParams();
  if (financialYear) {
    query.set('financialYear', financialYear);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<{
    financialYear: string;
    totalCollected: number;
    monthly: Array<{ month: string; total: number }>;
  }>(`/fees/reports/annual${suffix}`);
}

export function getAnnualSummaryExportUrl(format: 'pdf' | 'excel', financialYear?: string) {
  const query = new URLSearchParams();
  if (financialYear) {
    query.set('financialYear', financialYear);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return `${API_BASE}/fees/reports/annual/export/${format}${suffix}`;
}

export async function downloadAnnualSummaryReport(
  format: 'pdf' | 'excel',
  financialYear?: string,
): Promise<Blob> {
  const token = getToken();
  const url = getAnnualSummaryExportUrl(format, financialYear);

  const response = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Report download failed');
  }

  return response.blob();
}

export async function enrollStudent(payload: Record<string, unknown>) {
  return apiRequest('/students/enroll', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function sendParentInvite(studentId: string, payload: Record<string, unknown>) {
  return apiRequest(`/students/${studentId}/parent-invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function uploadStudentPhoto(studentId: string, file: File) {
  const formData = new FormData();
  formData.set('photo', file);

  return apiRequest(`/students/${studentId}/photo`, {
    method: 'POST',
    body: formData,
  });
}

export async function uploadStudentDocument(
  studentId: string,
  file: File,
  meta: { type: 'aadhaar' | 'school_tc' | 'other'; label?: string },
) {
  const formData = new FormData();
  formData.set('document', file);
  formData.set('type', meta.type);

  if (meta.label) {
    formData.set('label', meta.label);
  }

  return apiRequest(`/students/${studentId}/documents`, {
    method: 'POST',
    body: formData,
  });
}

export async function fetchBatches() {
  return apiRequest<{
    data: BatchListItem[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>('/batches');
}

export async function createBatch(payload: Record<string, unknown>) {
  return apiRequest('/batches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchBatchRoster(batchId: string) {
  return apiRequest<{
    batch: { id: string; name: string; subject: string };
    students: Array<{
      studentId: string;
      studentCode: string;
      name: string;
      status: string;
      attendancePercent: number;
    }>;
  }>(`/batches/${batchId}/roster`);
}

export async function fetchHolidays() {
  return apiRequest<{ data: HolidayItem[] }>('/batches/holidays');
}

export async function createHoliday(payload: Record<string, unknown>) {
  return apiRequest('/batches/holidays', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchAttendanceForBatchDate(params: { batchId: string; date: string }) {
  const query = new URLSearchParams({
    batch_id: params.batchId,
    date: params.date,
  });

  return apiRequest<BatchAttendanceResponse>(`/attendance?${query.toString()}`);
}

export async function upsertAttendance(payload: {
  batchId: string;
  date: string;
  entries: Array<{
    studentId: string;
    status: AttendanceStatus;
    note?: string;
  }>;
}) {
  return apiRequest<{
    batchId: string;
    date: string;
    mode: 'create' | 'edit';
    summary: { submitted: number; created: number; updated: number };
  }>('/attendance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchDashboardSummary() {
  return apiRequest<DashboardSummary>('/dashboard/summary');
}
