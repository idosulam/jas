# Jas — Shift & Earnings Tracker

A React + Vite app backed by Supabase for tracking work shifts, earnings, and weight.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run **one of these**:
   - **`supabase_tables/setup_all.sql`** — single file, sets up everything (drops existing tables first)
   - Or run the individual files in order: `workplaces.sql`, `shifts.sql`, `shift_presets.sql`, `events.sql`, `profile.sql`, `color_palettes.sql`
3. Copy your project URL and anon key from **Project Settings → API**

### 2. Environment

Create `.env` in the project root:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

### 3. Install & Run

```bash
npm install
npm run dev
```

## Tech Stack

- React 19 + Vite
- Supabase (Auth + Postgres + RLS)
- Tailwind CSS
- Framer Motion
