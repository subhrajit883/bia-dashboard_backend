# Academy Lead, Student & Fees Management Backend

## Requirements
- Node.js 20+
- MongoDB replica set (transactions are required for lead-to-student conversion)
- Cloudinary account
- SMTP email account

## Installation
1. Extract this project.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Fill MongoDB, JWT, Cloudinary, email and admin environment variables.
5. Set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env`.
6. Run `npm run seed:admin` once.
7. Run `npm run dev`.

## MongoDB transactions
The conversion endpoint uses a transaction. A local standalone MongoDB server will not support transactions. Use MongoDB Atlas or configure a local replica set.

## Authentication
Send `Authorization: Bearer <token>` on protected requests. Login also sets an HTTP-only cookie.

Login request:

{
  "email": "admin@example.com",
  "password": "your-password",
  "role": "admin"
}

For students, login by email is currently used by the shared login endpoint. Student ID login can be added by querying `s_id` instead; see note below.

## Main API endpoints

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register-counsellor` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/logout` | Logged-in |
| POST | `/api/auth/forgot-password` | Public |
| POST | `/api/auth/reset-password` | Public |
| PUT | `/api/auth/change-password` | Logged-in |
| GET | `/api/auth/me` | Logged-in |
| GET | `/api/admin/counsellors` | Admin |
| PATCH | `/api/admin/counsellors/:id/status` | Admin |
| POST | `/api/admin/accounts-users` | Admin |
| GET | `/api/admin/login-history` | Admin |
| GET/POST | `/api/leads` | Admin, Counsellor |
| GET/PUT | `/api/leads/:id` | Admin, assigned Counsellor |
| POST | `/api/leads/:id/follow-ups` | Admin, assigned Counsellor |
| POST | `/api/leads/:id/request-conversion` | Admin, assigned Counsellor |
| PATCH | `/api/leads/:id/assign` | Admin |
| GET/POST/PUT/DELETE | `/api/sources` | Read logged-in; write Admin |
| GET/POST/PUT/DELETE | `/api/courses` | Read logged-in; write Admin |
| GET | `/api/students` | Admin, Accounts, Counsellor |
| GET | `/api/students/:id` | Admin, Accounts, assigned Counsellor, Student self |
| POST | `/api/students/conversion/:id/approve` | Admin |
| POST | `/api/students/conversion/:id/reject` | Admin |
| POST | `/api/students/:id/documents` | Admin, Accounts, assigned Counsellor |
| GET | `/api/accounts/summary` | Admin, Accounts |
| GET | `/api/accounts/ledger/:studentId` | Admin, Accounts |
| GET/POST | `/api/payments` | Admin, Accounts |
| DELETE | `/api/payments/:id` | Admin |
| GET/POST | `/api/emails/templates` | Admin, Counsellor read |
| POST | `/api/emails/send` | Admin, assigned Counsellor |
| GET | `/api/reports/counsellor-performance` | Admin |
| GET | `/api/reports/counsellor-performance/export` | Admin |

## Important implementation notes
- Counsellor registration creates an inactive account. Admin must activate it.
- Admin alone can assign/reassign leads.
- Counsellors can only view and update their assigned leads.
- Payment status is recalculated from payment records when a payment is created or deleted.
- Login history captures IP, user agent, browser, operating system, device type, login and logout timestamps.
- IP addresses are not reliable exact location data.
- Student conversion returns a one-time initial password to the admin. Deliver it securely to the student and require a password change.
- Student login uses the `s_id` value in the request's `email` field for the shared login endpoint. For student login, send the Student ID in that field and set `role` to `student`. The frontend should label this field Student ID.
- For production, add audit logs for edits/deletions, email queueing, pagination on all large lists, and stricter field allowlists on every update endpoint.
