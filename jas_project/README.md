# Jas — Shift & Earnings Tracker

A React + Vite app backed by Supabase for tracking work shifts, earnings, weight, and shared household goals.

## Features

- **Shift Tracking** — Log work shifts with hours, tips, pay type (hourly/tips only), and notes
- **Calendar** — Visual calendar with shift events and reminders
- **Weight Tracking** — Daily weigh-ins with trend charts, BMI, and goal progress
- **Household Dashboard** — Combined earnings view for couples with per-person breakdowns
- **Earnings Charts** — Stacked bar charts showing daily earnings per household member
- **Shared Savings Goals** — Track savings goals together with contributions and progress bars
- **PWA Support** — Installable on mobile with offline caching
- **Workplace Management** — Configure multiple workplaces with hourly rates and colors
- **Shift Presets** — Quick-add common shifts with one tap
- **Color Palettes** — Customizable theme colors

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the individual files in order:
   - `workplaces.sql`
   - `shifts.sql`
   - `shift_presets.sql`
   - `events.sql`
   - `profile.sql`
   - `color_palettes.sql`
   - **`household.sql`** — enables the couple/household features (savings goals, shared dashboard)
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

## Household Setup

To use the couple features:

1. Run `household.sql` in your Supabase SQL Editor
2. One partner creates a household from the "Us" tab — they get an invite code
3. The other partner joins using that code
4. Both partners now see combined earnings, per-person breakdowns, and shared savings goals

## PWA

The app registers a service worker for offline support. To install on mobile:
- **iOS**: Safari → Share → Add to Home Screen
- **Android**: Chrome → Menu → Install App
