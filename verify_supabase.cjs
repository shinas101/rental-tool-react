const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env manually to avoid extra dependencies
let supabaseUrl = '';
let supabaseKey = '';

try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const value = trimmed.substring(index + 1).trim().replace(/^["']|["']$/g, '');
        if (key === 'VITE_SUPABASE_URL') supabaseUrl = value;
        if (key === 'VITE_SUPABASE_PUBLISHABLE_KEY' || key === 'VITE_SUPABASE_ANON_KEY') {
          supabaseKey = value;
        }
      }
    });
  }
} catch (err) {
  console.error('Failed to read .env file:', err.message);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is not defined in your .env file.');
  process.exit(1);
}

console.log('Connecting to Supabase...');
console.log('URL:', supabaseUrl);
console.log('Publishable Key:', supabaseKey.substring(0, 10) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  try {
    // 1. Test basic connection / fetch tools table info
    console.log('\n--- Checking connection & tools table ---');
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('*')
      .limit(5);

    if (toolsError) {
      console.error('❌ Connection or Query Error on "tools" table:', toolsError.message);
      console.log('Please ensure that:');
      console.log('1. Your Supabase database is active and online.');
      console.log('2. The schema and tables have been successfully created using "supabase_schema.sql".');
      console.log('3. Your .env credentials are correct.');
    } else {
      console.log('✅ Connection to Supabase is successful!');
      console.log(`✅ "tools" table exists. Found ${tools.length} record(s) in database.`);
      if (tools.length > 0) {
        console.log('Sample tools:', tools);
      }
    }

    // 2. Test rentals table
    console.log('\n--- Checking rentals table ---');
    const { data: rentals, error: rentalsError } = await supabase
      .from('rentals')
      .select('*')
      .limit(5);

    if (rentalsError) {
      console.error('❌ Query Error on "rentals" table:', rentalsError.message);
    } else {
      console.log(`✅ "rentals" table exists. Found ${rentals.length} record(s) in database.`);
    }

    // 3. Test RPC functions availability
    console.log('\n--- Checking Stored Procedures (RPCs) ---');
    const { error: rpcError } = await supabase.rpc('rent_tools', {
      p_customer_name: '',
      p_phone: '',
      p_rent_date: '2026-01-01',
      p_return_date: '2026-01-02',
      p_items: []
    });

    if (rpcError && rpcError.message.includes('does not exist')) {
      console.error('❌ rent_tools Stored Procedure: Not found. Did you run the RPC creations in supabase_schema.sql?');
    } else {
      console.log('✅ rent_tools Stored Procedure: Verified (exists).');
    }

  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

verify();
