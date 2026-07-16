# Jas — Shift & Earnings Tracker

A React + Vite app backed by Supabase for tracking work shifts, earnings, and weight.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the table scripts **in this order**:
   - `supabase_tables/workplaces.sql` ← run this first (includes schema grants)
   - `supabase_tables/shifts.sql`
   - `supabase_tables/shift_presets.sql`
   - `supabase_tables/events.sql`
   - `supabase_tables/profile.sql`
   - `supabase_tables/color_palettes.sql`
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
