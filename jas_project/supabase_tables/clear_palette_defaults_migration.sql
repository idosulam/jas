-- Migration: Clear old auto-seeded default colors from color_palettes.
-- Run this if you had the old seed data (indigo, pink, orange, green, cyan).
-- After this, only colors you add via the app will exist.

DELETE FROM public.color_palettes;
