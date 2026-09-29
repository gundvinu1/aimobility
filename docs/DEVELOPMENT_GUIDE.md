# AI-MOS — How to Run This Project Locally

> **Repository:** https://github.com/gundvinu1/aimobility.git

---

## Before You Start — Install These 4 Things

You only need to do this **once** on your computer.

---

### Step 1 — Install Node.js

1. Go to 👉 **https://nodejs.org**
2. Click the big green **"LTS"** button to download
3. Run the installer — just click Next → Next → Finish
4. Open **PowerShell** and check it worked:
   ```
   node --version
   ```
   You should see something like `v20.11.0`

---

### Step 2 — Install pnpm

Open **PowerShell** and run:
```
npm install -g pnpm
```
Check it worked:
```
pnpm --version
```
You should see something like `9.x.x`

---

### Step 3 — Install Docker Desktop

1. Go to 👉 **https://www.docker.com/products/docker-desktop**
2. Click **"Download for Windows"**
3. Run the installer — accept all defaults
4. After install, **restart your computer**
5. Open Docker Desktop from Start Menu — wait until the whale icon in the taskbar stops animating
6. Check it worked in PowerShell:
   ```
   docker --version
   ```
   You should see something like `Docker version 24.x.x`

---

### Step 4 — Install Git

1. Go to 👉 **https://git-scm.com/download/win**
2. Download and run the installer — accept all defaults
3. Check it worked:
   ```
   git --version
   ```
   You should see something like `git version 2.x.x`

---

## Now Set Up the Project

Do these steps **in order**. Open **PowerShell** and follow along.

---

### Step 5 — Download the Code from GitHub

```
git clone https://github.com/gundvinu1/aimobility.git
cd aimobility
```

Now you are inside the project folder.

---

### Step 6 — Create Your Environment File

This file contains the database password and other settings.

```
Copy-Item .env.example .env
```

> ✅ You don't need to change anything in this file for local development. The defaults work as-is.

---

### Step 7 — Start the Database and Cache

This starts PostgreSQL (database) and Redis (cache) using Docker.

```
docker compose up -d
```

Wait about 10 seconds, then check they are running:
```
docker compose ps
```

You should see **2 containers** with status **"Up"**:
```
NAME              STATUS
ai-mos-postgres   Up
ai-mos-redis      Up
```

> 💡 If you see nothing, make sure Docker Desktop is open and running.

---

### Step 8 — Install All Dependencies

This downloads all the code libraries the project needs.

```
pnpm install
```

> ⏳ This takes 2–3 minutes the first time. Wait for it to finish.

---

### Step 9 — Set Up the Database (First Time Only)

This creates the database tables and fills in the default data (roles, permissions, etc.)

Run these **3 commands one by one**:

**Command 1** — Go into the database folder:
```
cd packages\database
```

**Command 2** — Create the database tables:
```
$env:DATABASE_URL="postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public"; node_modules\.bin\prisma migrate dev
```

You should see: `Your database is now in sync with your schema.`

**Command 3** — Fill in default roles and permissions:
```
$env:DATABASE_URL="postgresql://aimosuser:aimospassword@localhost:5432/aimosdb?schema=public"; node_modules\.bin\ts-node prisma/seed.ts
```

You should see:
```
✅ Role: SUPER_ADMIN
✅ Role: OWNER
...
✅ Module 2 seed complete.
```

**Command 4** — Go back to the main project folder:
```
cd ..\..
```

---

### Step 10 — Start the Backend (API Server)

Open a **new PowerShell window** and run:

```
cd aimobility\apps\backend-api
pnpm run dev
```

Wait until you see:
```
🚀 AI-MOS Backend running on http://localhost:4000
✅ Database connection established
✅ Redis connection established
```

**Keep this window open.** ← Do not close it.

---

### Step 11 — Start the Frontend (Dashboard)

Open **another new PowerShell window** and run:

```
cd aimobility\apps\admin-web
pnpm run dev
```

Wait until you see:
```
✓ Ready in 2.3s
- Local: http://localhost:3000
```

**Keep this window open too.**

---

## ✅ Done! Open These in Your Browser

| What | URL |
|------|-----|
| 🖥️ **Dashboard (Login page)** | http://localhost:3000 |
| 📚 **API Docs (Swagger)** | http://localhost:4000/api/docs |
| ❤️ **Health Check** | http://localhost:4000/api/v1/health/live |

---

## How to Stop Everything

When you're done working:

1. Press **Ctrl + C** in the backend PowerShell window
2. Press **Ctrl + C** in the frontend PowerShell window
3. Stop Docker:
   ```
   docker compose down
   ```

---

## How to Start Again Next Time

Next time you want to run the project, you only need **3 steps**:

**Step 1** — Start Docker services:
```
docker compose up -d
```

**Step 2** — Start the backend (new PowerShell window):
```
cd aimobility\apps\backend-api
pnpm run dev
```

**Step 3** — Start the frontend (another new PowerShell window):
```
cd aimobility\apps\admin-web
pnpm run dev
```

> ⚡ Steps 5–9 from above are **one-time setup only**. You never need to repeat them.

---

## Something Went Wrong?

### "docker compose up" doesn't work
→ Make sure **Docker Desktop is open** and the whale icon is in your taskbar.

### "pnpm is not recognized"
→ Close PowerShell and open it again after installing pnpm.

### Port 4000 already in use
→ Another app is using that port. Find it and close it:
```
netstat -ano | findstr :4000
```
Then kill it using Task Manager.

### Backend shows "Invalid environment variables"
→ Make sure you copied `.env.example` to `.env` in Step 6.

### Database errors
→ Make sure Docker is running (`docker compose ps` shows 2 containers "Up") before starting the backend.

---

## Summary — What You Need Open

```
┌─────────────────────────────────────────────────────────┐
│  Window 1 (PowerShell)  →  docker compose up -d         │
│                                                          │
│  Window 2 (PowerShell)  →  Backend  (port 4000)         │
│                             apps/backend-api: pnpm dev  │
│                                                          │
│  Window 3 (PowerShell)  →  Frontend (port 3000)         │
│                             apps/admin-web:   pnpm dev  │
│                                                          │
│  Browser  →  http://localhost:3000  (Dashboard)         │
└─────────────────────────────────────────────────────────┘
```
