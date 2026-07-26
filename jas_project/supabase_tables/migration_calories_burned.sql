-- Migration: Add calories_burned column to workout_logs if missing
-- Run this in your Supabase SQL editor

ALTER TABLE workout_logs
ADD COLUMN IF NOT EXISTS calories_burned numeric(7,1) DEFAULT 0;
