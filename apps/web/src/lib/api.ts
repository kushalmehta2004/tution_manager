export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

export type FeeStructureSummary = {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  subject: string | null;
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
