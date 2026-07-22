# Jas — Shift & Earnings Tracker

A React + Vite app backed by Supabase for tracking work shifts, earnings, weight, shared household goals, and expenses.

## Features

- **Shift Tracking** — Log work shifts with hours, tips, pay type (hourly/tips only), and notes
- **Calendar** — Visual calendar with shift events and reminders
- **Weight Tracking** — Daily weigh-ins with trend charts, BMI, and goal progress
- **Household Dashboard** — Combined earnings view for couples with per-person breakdowns
- **Earnings Charts** — Stacked bar charts showing daily earnings per household member
- **Shared Savings Goals** — Track savings goals together with contributions and progress bars
- **Expense Tracking** — Spendee-style expense and income tracking with categories
- **Recurring Transactions** — Auto-generating recurring bills, subscriptions, and income
- **Analytics** — Donut charts, category breakdowns, per-member analysis, and daily trends
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
   - **`household_transactions.sql`** — enables expense tracking, categories, and recurring transactions
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

1. Run `household.sql` then `household_transactions.sql` in your Supabase SQL Editor
2. One partner creates a household from the "Us" tab — they get an invite code
3. The other partner joins using that code
4. Both partners now see combined earnings, per-person breakdowns, shared savings goals, and expense tracking

### Household Tabs

- **Overview** — Combined shift earnings stats, daily earnings chart, savings goals, and quick transaction summary
- **Transactions** — Add/edit/delete expenses and income with categories, dates, and notes. Filtered by month with category breakdown bars
- **Recurring** — Manage recurring bills and income (daily, weekly, biweekly, monthly, yearly). Toggle active/inactive. Monthly cost estimate
- **Analytics** — Donut chart by category, per-member spending breakdown, daily trend bar chart. Toggle between expense and income views

### Recurring Transactions

To auto-generate transactions from recurring templates, set up a daily trigger:

**Option A: Supabase pg_cron** (if available)
```sql
SELECT cron.schedule('generate-recurring', '0 2 * * *', 'SELECT public.generate_recurring_transactions()');
```

**Option B: Supabase Edge Function** — call `SELECT public.generate_recurring_transactions()` on a schedule

**Option C: Manual** — run the function manually from the SQL Editor when needed

## PWA

The app registers a service worker for offline support. To install on mobile:
- **iOS**: Safari → Share → Add to Home Screen
- **Android**: Chrome → Menu → Install App
