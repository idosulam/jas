const API = "https://api.supabase.com/v1/projects/tgosfxrmaspvejjmkffd/database/query";
const H = { "Authorization": "Bearer…1981", "Content-Type": "application/json" };

async function run(sql) {
  const res = await fetch(API, { method: "POST", headers: H, body: JSON.stringify({ query: sql }) });
  return await res.json();
}

// Check all policies on households and household_members
console.log("=== POLICIES ===");
const policies = await run(`
  SELECT tablename, policyname, cmd, qual, with_check 
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND tablename IN ('households','household_members','savings_goals','savings_contributions')
  ORDER BY tablename, policyname;
`);
console.log(JSON.stringify(policies, null, 2));

// Check table structure
console.log("\n=== HOUSEHOLDS COLUMNS ===");
const cols = await run(`
  SELECT column_name, is_nullable, column_default 
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'households'
  ORDER BY ordinal_position;
`);
console.log(JSON.stringify(cols, null, 2));

// Check if RLS is actually enabled
console.log("\n=== RLS STATUS ===");
const rls = await run(`
  SELECT tablename, rowsecurity FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename IN ('households','household_members','savings_goals','savings_contributions');
`);
console.log(JSON.stringify(rls, null, 2));
