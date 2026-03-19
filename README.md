# UniSchedule — University Digital Timetable & Reminder System

> **400-Level Final Year Project** — Educational Technology, University of Ilorin  
> Built with React · TypeScript · Node.js · Express · MongoDB · Tailwind CSS

---

## Project Overview

UniSchedule is a role-based digital timetable and notification system for university students. It allows class reps and level advisers to manage class schedules, tests, and exams, and automatically notifies students via email when venues change or assessments are due.

### The 4 Roles

| Role | Access |
|------|--------|
| **Super Admin** | Full system control — manage all users, levels, and data |
| **Level Adviser** | Approve timetables, send official alerts, manage academic calendar |
| **Class Rep** | Add/edit timetable, update venue, add tests/exams, send email alerts |
| **Student** | View timetable, tests, and exams; receive email notifications |

> **Rule:** Only **one Class Rep** and **one Level Adviser** per level + course of study combination.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS (Royal Blue theme) |
| State | TanStack React Query |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB Atlas + Mongoose |
| Auth | JWT (Role-Based Access Control) |
| Email | Nodemailer + Gmail SMTP |
| Scheduler | node-cron (auto reminders at 8 PM daily) |

---

## Project Structure

```
unischedule/
├── client/                  # React + TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── layout/      # AppLayout (sidebar, topbar)
│   │   ├── context/         # AuthContext (JWT + user state)
│   │   ├── pages/           # Dashboard, Timetable, Events, Notifications, Users
│   │   ├── types/           # All TypeScript interfaces
│   │   └── utils/           # Axios API client
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
└── server/                  # Node.js + Express backend
    └── src/
        ├── config/          # MongoDB connection
        ├── controllers/     # auth, timetable, event, notification, user
        ├── middleware/      # JWT protect + role authorize
        ├── models/          # User, Timetable, Event, Notification
        ├── routes/          # All API routes
        └── utils/           # mailer.ts, cronJobs.ts
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier works)
- Gmail account (with App Password for SMTP)

---

### 1. Clone / Extract the project

```bash
unzip unischedule.zip
cd unischedule
```

---

### 2. Backend Setup

```bash
cd server
npm install
cp .env.example .env
```

Edit `.env` with your values:

```env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/unischedule
JWT_SECRET=your_random_secret_here
MAIL_USER=your_gmail@gmail.com
MAIL_PASS=your_gmail_app_password
CLIENT_URL=http://localhost:5173
```

**Getting a Gmail App Password:**
1. Go to Google Account → Security → 2-Step Verification → App Passwords
2. Create an app password for "Mail"
3. Use that 16-character password as `MAIL_PASS`

Start the backend:
```bash
npm run dev
```

The server runs at **http://localhost:5000**

---

### 3. Frontend Setup

```bash
cd ../client
npm install
npm run dev
```

The app runs at **http://localhost:5173**

---

### 4. Create the Super Admin

Use a REST client (Postman, Thunder Client) or `curl`:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Your Name",
    "email": "admin@unilorin.edu.ng",
    "password": "yourpassword",
    "faculty": "Educational Technology",
    "level": "400",
    "courseOfStudy": "Educational Technology"
  }'
```

Then in MongoDB Atlas (or Compass), find this user and change `role` to `"super_admin"`.

After that, log in as Super Admin via the app and use the **Users** page to create Class Rep and Level Adviser accounts.

---

## API Endpoints

### Auth
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET  | `/api/auth/me` | Authenticated |

### Timetable
| Method | Endpoint | Access |
|--------|----------|--------|
| GET    | `/api/timetable` | All |
| POST   | `/api/timetable` | Admin, Adviser, Rep |
| PUT    | `/api/timetable/:id` | Admin, Adviser, Rep |
| PUT    | `/api/timetable/venue` | Admin, Adviser, Rep |
| DELETE | `/api/timetable/:id` | Admin, Adviser |

### Events (Tests & Exams)
| Method | Endpoint | Access |
|--------|----------|--------|
| GET    | `/api/events` | All |
| POST   | `/api/events` | Admin, Adviser, Rep |
| PUT    | `/api/events/:id` | Admin, Adviser, Rep |
| DELETE | `/api/events/:id` | Admin, Adviser, Rep |
| POST   | `/api/events/:id/remind` | Admin, Adviser, Rep |

### Notifications
| Method | Endpoint | Access |
|--------|----------|--------|
| GET    | `/api/notifications` | All |
| POST   | `/api/notifications/announce` | Admin, Adviser, Rep |

### Users (Super Admin only)
| Method | Endpoint | Access |
|--------|----------|--------|
| GET    | `/api/users` | Super Admin |
| POST   | `/api/users` | Super Admin |
| GET    | `/api/users/stats` | All |
| PUT    | `/api/users/:id` | Super Admin |
| PATCH  | `/api/users/:id/toggle` | Super Admin |
| DELETE | `/api/users/:id` | Super Admin |

---

## Email Notifications

The system sends automated emails for:

1. **Venue change** — immediately when a Class Rep or Adviser updates a venue
2. **Test/Exam reminder** — every night at 8:00 PM for tomorrow's scheduled tests/exams
3. **Manual announcement** — when a Class Rep sends a broadcast message
4. **New event notification** — when an event is created with "Send email now" checked

---

## Build for Production

```bash
# Frontend
cd client && npm run build    # outputs to client/dist/

# Backend
cd server && npm run build    # outputs to server/dist/
npm start
```

---

## Academic Reference

This project addresses the following research areas in Educational Technology:
- ICT integration in Nigerian university education
- Learning Management Systems (LMS) and student academic support
- Role-Based Access Control (RBAC) in educational platforms  
- Automated notification systems for improving student preparation
- Digital transformation of academic administration in HEIs

**Reference systems:** MyStudyLife (web.mystudylife.com), Google Classroom, Moodle

---

*Developed as a 400-Level Final Year Project — faculty of Educational Technology, University of Ilorin*
