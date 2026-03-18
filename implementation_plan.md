# Tuition Manager — Phase-Wise Implementation Plan
> **Stack:** Next.js 14 · Node.js/Express · PostgreSQL (Supabase) · Prisma · Redis (Upstash) · Vercel · Render  
> **Target:** Indian solo tuition teachers & small coaching institutes  
> **Total infra cost (months 1–5):** ₹799 (domain only — all services on free tiers)

---

## Overview

| Phase | Focus | Timeline |
|-------|-------|----------|
| 0 | ✅ Foundation — Project Setup & Auth (Completed) | Week 1 |
| 1 | Core MVP — Students & Batches | Week 2–3 |
| 2 | Daily Ops — Attendance System | Week 4 |
| 3 | Revenue Engine — Fee Management | Week 5–6 |
| 4 | Value Add — Test & Performance Tracking | Week 7 |
| 5 | Parent Engagement — Parent Portal (PWA) | Week 8 |
| 6 | Growth Features — Communication & Staff | Week 9 |
| 7 | Analytics & Payments Integration | Week 10 |
| 8 | Polish, Launch & GTM | Week 11–12 |

---

## Phase 0 — Foundation & Project Setup ✅ Completed
**Duration:** Week 1  
**Goal:** Working skeleton, CI/CD, database up, auth implemented.
**Status:** Completed on March 18, 2026

### 0.1 Repository & Tooling
- [ ] Init monorepo: `/apps/web` (Next.js) + `/apps/api` (Express) + `/packages/shared` (shared Zod schemas & types)
- [ ] TypeScript strict mode across all workspaces
- [ ] ESLint + Prettier config
- [ ] Git repository with `main` and `dev` branches
- [ ] GitHub Actions CI pipeline — lint + type-check on every push

### 0.2 Infrastructure Setup
- [ ] Create Supabase project — note the `DATABASE_URL`
- [ ] Create Upstash Redis instance — note `UPSTASH_REDIS_REST_URL`
- [ ] Create Cloudflare R2 bucket for file storage
- [ ] Connect Render.com for API hosting (keep-alive ping with UptimeRobot)
- [ ] Deploy Next.js to Vercel — connect GitHub for auto-deploy
- [ ] Add Sentry project for error tracking (both frontend and API)

### 0.3 Database Foundation
- [ ] Init Prisma with PostgreSQL connection
- [ ] Create all 13 tables in schema.prisma with correct types, enums, and relations:
  - `teachers`, `staff`, `students`, `parents`
  - `batches`, `batch_students`
  - `attendance`
  - `fee_structures`, `student_fees`, `fee_payments`
  - `tests`, `test_results`
  - `announcements`
- [ ] All tables include `id (UUID PK)`, `created_at`, `updated_at`, `deleted_at` (soft deletes)
- [ ] All fee/monetary columns stored as `BIGINT` in **paise** (never floats)
- [ ] Run first migration (`prisma migrate deploy`)

### 0.4 Authentication System
- [ ] Teacher registration & login (email + password, bcrypt hashed)
- [ ] JWT access token (15 min) + refresh token (30 days) strategy
- [ ] Three auth roles: `teacher`, `staff`, `parent` — all handled in one system
- [ ] `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- [ ] Auth middleware for all protected routes
- [ ] Parent invite link flow — send SMS/WhatsApp link that creates parent account on first open

### 0.5 Dev Environment
- [ ] `.env.example` file with all required variables documented
- [ ] Docker Compose for local PostgreSQL + Redis (optional but recommended for team)
- [ ] Postman / Bruno collection for API testing

---

## Phase 1 — Core MVP: Student & Batch Management
**Duration:** Week 2–3  
**Goal:** A teacher can log in, add students, create batches, and assign students to batches.

### 1.1 Teacher Dashboard Shell
- [x] Post-login landing — sidebar navigation with module links
- [x] Dashboard layout with shadcn/ui: sidebar, header, main content area
- [x] Mobile-responsive layout (teachers use phones — mobile-first)
- [x] Dashboard page renders placeholder cards for all 6 KPIs (data populated in later phases)

### 1.2 Student Management — Module 2
**Student Profiles (2A)**
- [x] `GET /students` — paginated list with search & filter
- [x] `POST /students` — create with auto-generated `student_code` (TM-YYYY-001 format)
- [x] `GET /students/:id` — full profile with academic history
- [x] `PUT /students/:id` — update profile
- [x] `DELETE /students/:id` — soft delete
- [x] Student profile page: photo, personal details, enrolled batches, fee summary, test history
- [x] Photo upload to Supabase Storage (via Multer)
- [x] Document storage (Aadhaar copy, school TC) to Supabase Storage

**Enrollment & Onboarding (2B)**
- [x] New student enrollment form with React Hook Form + Zod validation
- [x] Fee structure assignment at enrollment time
- [x] Auto-generate fee schedule (all future due dates created automatically on enrollment)
- [ ] Parent account invite — send WhatsApp/SMS link to parent phone number (pending full invite acceptance flow)

### 1.3 Batch & Schedule Management — Module 3
- [x] `GET /batches`, `POST /batches`, `PUT /batches/:id`, `DELETE /batches/:id`
- [x] `POST /batches/:id/students` — enroll student in batch
- [x] Batch form: name, subject, teacher/faculty, capacity, days of week, start/end time, room, academic year, color
- [x] Visual weekly timetable — colour-coded grid by `color_hex` per batch
- [x] Batch roster view — all students in a batch with their attendance %
- [x] Capacity alerts — warning UI when batch is ≥ 90% full
- [x] Holiday management — mark dates as holidays; attendance auto-skipped
- [x] Trial student tracking — `status = 'trial'` on student, separate list view

---

## Phase 2 — Daily Operations: Attendance System
**Duration:** Week 4  
**Goal:** Marking attendance for 30 students in under 30 seconds — the #1 daily action.

### 2.1 Attendance Marking — Module 4
- [x] `POST /attendance` — bulk create for a batch + date
- [x] `GET /attendance?batch_id=&date=` — fetch day's attendance
- [x] One-tap batch attendance screen: list all students, tap each → Present / Absent / Late, then Submit
- [x] "Mark All Present" button with individual exception toggles
- [ ] QR code attendance — generate a daily signed QR per batch; students scan to self-mark (for older students)
- [x] Late arrival marking — distinct `late` status
- [x] Prevent duplicate marking — if attendance exists for batch+date, load edit mode

### 2.2 Attendance Analytics
- [x] Attendance calendar per student — monthly heatmap (present / absent / late / holiday)
- [x] Attendance % auto-calculated and shown on student profile
- [x] Low attendance alerts — trigger when student drops below 75%; show badge in dashboard
- [x] `GET /attendance/reports` — export by batch, by student, or by date range
- [x] PDF export (use `pdfkit` or `puppeteer`) + Excel export (`exceljs`)

### 2.3 Dashboard — Module 1 (First Live Data)
- [x] Today's attendance summary card: X present / Y absent across all batches
- [x] Overdue fee alerts list (pulls from student_fees where `status = 'overdue'`)
- [x] Upcoming batch schedule — next 3 classes
- [x] Quick action buttons: Mark Attendance, Add Student, Record Payment
- [x] Monthly revenue trend chart (Recharts bar chart — last 6 months)

---

## Phase 3 — Revenue Engine: Fee Management
**Duration:** Week 5–6  
**Goal:** The most important module. Nail this and retention is guaranteed.

### 3.1 Fee Structures — Module 5A
- [ ] `GET /fee-structures`, `POST /fee-structures`, `PUT /fee-structures/:id`
- [ ] Support all frequencies: `monthly`, `quarterly`, `half_yearly`, `annual`, `one_time`, `per_class`
- [ ] Named structures: "Monthly Maths", "JEE Full Course", "Half-yearly Science"
- [ ] Subject-wise fee (different fee per subject for same student)
- [ ] Discount management: sibling discount, early-payment discount, need-based concession — stored as `discount_amount` + `discount_reason` on `student_fees`

### 3.2 Fee Collection — Module 5B
- [ ] `POST /fee-payments` — record manual payment (cash, UPI, bank transfer, cheque)
- [ ] `reference_number` field for UPI transaction ID / cheque number
- [ ] Partial payment support — update `student_fees.status` to `partial`, track remaining balance
- [ ] Auto-generate receipt PDF — include institute name, student name, amount, date, reference number
- [ ] Receipt stored on Cloudflare R2; shareable WhatsApp link returned in API response
- [ ] Daily collection summary — how much collected today, broken down by payment mode
- [ ] Auto-update `student_fees.status` → `paid` when full amount received; `overdue` via cron job

### 3.3 WhatsApp Fee Reminders — Module 5C (Core Value Prop)
- [ ] Integrate WATI (WhatsApp Business API) — `₹999/mo`, essential from launch
- [ ] BullMQ job queue (backed by Upstash Redis) for async reminder sending
- [ ] node-cron job: runs daily at 9 AM IST, enqueues reminders for:
  - 3 days before due date
  - On due date
  - 3 days after due date
  - Escalation to parent after 7 days overdue
- [ ] Custom reminder message — teacher writes once, system sends (template variables: `{{student_name}}`, `{{amount}}`, `{{due_date}}`)
- [ ] Track reminder status on `student_fees`: `reminder_count`, `last_reminder_at`
- [ ] One-click manual reminder — teacher sends instant reminder from any overdue row
- [ ] WATI delivery status webhook — update `sent → delivered → read` per reminder

### 3.4 Fee Reports — Module 5D
- [ ] Monthly collection report: total collected, total pending, mode-wise breakdown
- [ ] Student-wise ledger: full payment history per student (shareable with parent)
- [ ] Outstanding fees report: all dues sorted by amount, with ageing buckets (30/60/90 days)
- [ ] Annual fee summary for income tax (FY total income, exportable as PDF/Excel)
- [ ] Dashboard fee card updated: progress bar (collected vs. total expected this month)

---

## Phase 4 — Value Add: Test & Performance Tracking
**Duration:** Week 7  
**Goal:** Give parents a reason to stay loyal to the teacher. Professional report cards.

### 4.1 Test Management — Module 6
- [ ] `POST /tests` — create test: title, subject, batch, date, max marks, passing marks, weightage, topics covered
- [ ] `POST /tests/:id/results` — bulk enter marks (student grid: names in rows, marks in one column)
- [ ] Auto-calculate per result: percentage, pass/fail, rank within batch
- [ ] Grade assignment (A/B/C/D/F) based on percentage bands (configurable per teacher)
- [ ] `is_published` flag — results visible to parents only after teacher publishes

### 4.2 Performance Analytics
- [ ] Performance trend chart per student — last 10 test scores (Recharts line chart)
- [ ] Batch performance view: class average, topper, pass %, distribution histogram
- [ ] Weak topic tagging — teacher marks which `topics_covered` a student struggled in
- [ ] Parent notification — auto-send test result to parent via WhatsApp when teacher publishes
- [ ] Quarterly progress report card — PDF with student photo, all test scores, attendance %, teacher remarks
- [ ] Student academic history page — all tests, scores, and attendance in one timeline

---

## Phase 5 — Parent Engagement: Parent Portal (PWA)
**Duration:** Week 8  
**Goal:** Make teachers look professional. Zero churn once parents are engaged.

### 5.1 Parent Portal Features — Module 7
- [ ] Separate parent login (phone number + OTP or password)
- [ ] Read-only dashboard for the parent showing their child's data:
  - **Attendance:** Did my child attend today? (React Query auto-refetch every 30s)
  - **Fees:** What is due, what is paid — "Pay Now" button (Razorpay)
  - **Tests:** Latest score, trend chart, teacher's remarks
  - **Timetable:** Child's batch schedule for the week
  - **Announcements:** Teacher broadcasts
- [ ] In-app one-on-one chat with teacher (teacher can mute/disable per parent)
- [ ] `notification_prefs` JSONB on `parents` — parent controls which notifications they receive
- [ ] Track `last_login_at` for parent engagement analytics

### 5.2 Progressive Web App (PWA)
- [ ] Configure `next-pwa` for the parent-facing pages
- [ ] Web App Manifest: name, icons, theme colour, `display: standalone`
- [ ] Service worker for offline reading of last-loaded data (attendance, timetable)
- [ ] "Add to Home Screen" prompt — no Play Store needed
- [ ] Separate `/parent` route group in Next.js with its own layout

---

## Phase 6 — Growth Features: Communication & Staff Management
**Duration:** Week 9

### 6.1 Communication & Announcements — Module 8
- [ ] `POST /announcements` — broadcast to batch, all students, or individual student/parent
- [ ] Channels: WhatsApp (via WATI), SMS (Twilio/MSG91), in-app notice board
- [ ] Announcement board in parent portal — all active announcements shown on login
- [ ] Message templates — teacher saves frequently-used messages (fee reminder, holiday notice, test alert)
- [ ] Automated triggers — test result published, fee due, attendance low → auto-message
- [ ] Delivery tracking — message sent/delivered/read status per recipient

### 6.2 Teacher & Staff Management — Module 9
> *Only relevant for multi-faculty coaching institutes*

- [ ] `POST /staff` — add faculty/admin/accountant profiles
- [ ] Role-based access control: `faculty` sees only own batches; `accountant` sees fees only; `admin` sees all
- [ ] Assign batches to faculty (`assigned_faculty_id` on batch)
- [ ] Substitute teacher assignment — mark faculty absent for a day, assign substitute batch coverage
- [ ] Faculty attendance — institute owner marks daily attendance for staff
- [ ] Salary management: define `monthly_salary`, record monthly payment, auto-generate salary slip PDF
- [ ] Optional: parent satisfaction rating per faculty per quarter

---

## Phase 7 — Analytics & Payments Integration
**Duration:** Week 10

### 7.1 Reports & Analytics — Module 10
Full reporting suite for all roles:

| Report | Data | Audience |
|--------|------|----------|
| Student Progress Report | Test scores trend, attendance, fee status → PDF | Parent/Teacher |
| Batch Performance Report | Class average, topper, weak areas per batch | Teacher |
| Annual Income Summary | Total income for FY (income tax filing) | Teacher/CA |
| Enrollment & Attrition | New enrollments vs dropouts per month | Institute Owner |
| Faculty Salary Register | Salary paid per faculty per month | Institute Owner |
| Outstanding Fees Ageing | Dues bucketed into 30/60/90 day bands | Teacher |

- [ ] PDF generation for all report types (`pdfkit` or `puppeteer`)
- [ ] Excel export for all tabular reports (`exceljs`)
- [ ] Dashboard analytics expanded: revenue trend, enrollment growth, batch occupancy
- [ ] Date range filters on all reports

### 7.2 Razorpay Online Fee Collection
- [ ] Create Razorpay order from API when parent clicks "Pay Now"
- [ ] Razorpay checkout opens in parent portal (web SDK)
- [ ] Webhook: `payment.captured` → auto-create `fee_payments` record, update `student_fees.status = 'paid'`
- [ ] Auto-generate and WhatsApp the payment receipt PDF
- [ ] Store `razorpay_payment_id` on `fee_payments` for reconciliation
- [ ] `razorpay_account_id` on `teachers` for split/marketplace payments (future)

### 7.3 Caching & Performance
- [ ] Redis caching for: dashboard stats, attendance summaries, student lists
- [ ] Cache invalidation strategy: invalidate on write for relevant keys
- [ ] Upstash rate limiting on auth endpoints (prevent brute-force)
- [ ] React Query stale-while-revalidate on frontend for perceived performance

---

## Phase 8 — Polish, Launch & Go-to-Market
**Duration:** Week 11–12

### 8.1 UI/UX Polish
- [ ] Mobile-first audit — every screen tested on 375px wide (the median Indian phone)
- [ ] Loading states and skeleton screens for all data-heavy pages
- [ ] Empty states — helpful prompts when no students/batches/tests exist yet
- [ ] Toast notifications for all async actions (Sonner/shadcn toast)
- [ ] Error boundaries in React — graceful degradation on API failures
- [ ] Accessibility pass: ARIA labels, keyboard navigation, color contrast

### 8.2 Security Hardening
- [ ] Input validation with Zod on all API routes (prevent injection)
- [ ] SQL injection prevention via Prisma parameterised queries (already covered)
- [ ] XSS prevention: sanitize all user-supplied HTML; use `next/headers` CSP headers
- [ ] File upload validation: whitelist allowed MIME types, max file size limits
- [ ] JWT secret rotation policy & secure cookie settings (`httpOnly`, `sameSite`, `secure`)
- [ ] Helmet.js on Express for HTTP security headers
- [ ] CORS configuration — whitelist only Vercel frontend domain

### 8.3 Subscription & Billing
- [ ] Pricing tiers: `free` (1 batch, 20 students), `starter` (₹199/mo), `pro` (₹499/mo)
- [ ] Feature gates checked server-side based on `subscription_plan`
- [ ] Razorpay subscription for teacher billing (recurring monthly)
- [ ] Free 3-month trial for early users (set `subscription_expires_at` +90 days on signup)

### 8.4 Landing Page & Onboarding
- [ ] Public marketing page: hero, feature highlights, pricing table, testimonials
- [ ] Onboarding flow post-signup: guided 3-step setup (create batch → add student → mark attendance)
- [ ] Demo mode — pre-loaded sample data so lead can try before signing up

### 8.5 Go-to-Market Execution
**Week 1–2 (Local City)**
- [ ] List 20–30 coaching centres within 5 km
- [ ] Walk-in demos with laptop + live product
- [ ] Offer white-glove setup: "I'll add all your students this weekend"
- [ ] Target: 3 active paying teachers by end of Month 1

**Month 2–3 (WhatsApp Groups)**
- [ ] Join city-level tuition teacher WhatsApp groups
- [ ] Share 60-second screen recording of the fee reminder feature
- [ ] Offer 3-month free trial to first 10 signups from each group

**Month 3–4 (SEO Content)**
- [ ] 10 blog posts targeting: "best app for coaching classes India", "how to track student attendance tuition"
- [ ] YouTube channel: tutorials and demo videos
- [ ] Organic signups expected from Month 6 onward

**Month 4 (Referral Program)**
- [ ] Teacher refers teacher → both get 1 month free
- [ ] In-app referral link generation
- [ ] Target: 30% of new signups via referral by Month 6

---

## Database Schema Summary

All tables use UUID primary keys, timestamps (`created_at`, `updated_at`, `deleted_at`), and soft deletes.

```
teachers          → Core user/teacher account + subscription
staff             → Faculty and admin at a coaching institute
students          → Student profiles with enrollment status
parents           → Parent accounts linked to students (n:1)
batches           → Batch/class definitions with schedule
batch_students    → Junction: which students are in which batch
attendance        → Daily attendance record per student per batch
fee_structures    → Named, reusable fee templates
student_fees      → Individual fee dues per student (auto-generated)
fee_payments      → Actual payment records with mode & receipt
tests             → Test metadata (name, date, batch, max marks)
test_results      → Per-student marks + auto-calculated grade/rank
announcements     → Broadcasts to batch/all/individual
```

---

## Tech Stack Reference

### Frontend (`/apps/web` — Vercel)
| Library | Purpose |
|---------|---------|
| Next.js 14 (App Router) | Web app + parent PWA |
| TypeScript | Type safety |
| Tailwind CSS | Styling (mobile-first) |
| shadcn/ui | Component library |
| React Query (TanStack) | Data fetching, auto-refetch |
| React Hook Form + Zod | Forms & validation |
| Recharts | Charts (fee trend, attendance, test scores) |
| React Table (TanStack) | Sortable/filterable data tables |
| next-pwa | Parent portal as installable PWA |

### Backend (`/apps/api` — Render.com)
| Library | Purpose |
|---------|---------|
| Node.js + Express.js | REST API |
| TypeScript | Shared types with frontend |
| Prisma ORM | Type-safe DB queries + migrations |
| PostgreSQL (Supabase) | Primary database (500 MB free) |
| Redis (Upstash) | Cache + BullMQ job queue |
| BullMQ | Async WhatsApp reminder jobs |
| JWT + bcrypt | Authentication + password hashing |
| Multer | File uploads to Cloudflare R2 |
| node-cron | Scheduled jobs (9 AM fee reminder sweep) |
| Zod | API input validation |
| Helmet.js | HTTP security headers |

### Infrastructure (All Free Tier)
| Service | Use | Free Limit |
|---------|-----|------------|
| Vercel | Frontend hosting | Unlimited |
| Render.com | API hosting | 750 hrs/month |
| Supabase | PostgreSQL | 500 MB |
| Upstash | Redis | 10K commands/day |
| Cloudflare R2 | File storage | 10 GB |
| GitHub Actions | CI/CD | 2,000 min/month |
| Resend | Email | 3,000/month |
| Sentry | Error tracking | 5,000 errors/month |
| WATI | WhatsApp Business API | ₹999/month (paid) |
| Razorpay | Online payments | 2% per transaction |

---

## Break-Even Target
- **Cost:** ₹999/month (WATI) + ₹799 domain = ~₹1,800/month
- **Break-even:** 9–10 teachers on `starter` plan (₹199/mo) or 4 on `pro` (₹499/mo)
- **Free tier infra handles 500+ teachers** — no infra cost until meaningful scale

---

*Blueprint source: Tuition_Manager_Blueprint.docx · Plan generated: March 2026*
