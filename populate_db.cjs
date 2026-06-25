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

const supabase = createClient(supabaseUrl, supabaseKey);

const sampleTools = [
  { name: 'Concrete Mixer', available_qty: 5, rate_per_day: 45.00 },
  { name: 'Demolition Hammer', available_qty: 8, rate_per_day: 30.00 },
  { name: 'Cordless Drill', available_qty: 15, rate_per_day: 12.50 },
  { name: 'Angle Grinder', available_qty: 10, rate_per_day: 15.00 },
  { name: 'Pressure Washer', available_qty: 6, rate_per_day: 25.00 },
  { name: 'Lawn Mower', available_qty: 4, rate_per_day: 20.00 },
  { name: 'Ladder 20ft', available_qty: 12, rate_per_day: 10.00 },
  { name: 'Chainsaw', available_qty: 7, rate_per_day: 35.00 }
];

async function populate() {
  console.log('Populating Supabase database...');

  try {
    // 1. Clear existing database rows
    console.log('Clearing existing data...');
    const { error: clearRentalsError } = await supabase.from('rentals').delete().neq('id', 0);
    if (clearRentalsError) throw clearRentalsError;

    const { error: clearToolsError } = await supabase.from('tools').delete().neq('id', 0);
    if (clearToolsError) throw clearToolsError;

    // 2. Insert tools
    console.log('Inserting sample tools...');
    const { data: insertedTools, error: insertToolsError } = await supabase
      .from('tools')
      .insert(sampleTools)
      .select();

    if (insertToolsError) throw insertToolsError;
    console.log(`✅ Successfully inserted ${insertedTools.length} tools.`);

    // 3. Setup rentals
    console.log('Inserting sample rentals...');

    // A. John Doe (Active - multiple tools)
    const johnGroupId = 'a1f8b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c';
    const johnRentals = [
      {
        group_id: johnGroupId,
        customer_name: 'John Doe',
        phone: '9876543210',
        tool_name: 'Concrete Mixer',
        quantity: 1,
        rent_date: '2026-06-20',
        return_date: '2026-06-26',
        returned: false,
        paid: true
      },
      {
        group_id: johnGroupId,
        customer_name: 'John Doe',
        phone: '9876543210',
        tool_name: 'Cordless Drill',
        quantity: 2,
        rent_date: '2026-06-20',
        return_date: '2026-06-26',
        returned: false,
        paid: true
      }
    ];

    // B. Alice Smith (Active - single tool)
    const aliceGroupId = 'b2e9c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d';
    const aliceRentals = [
      {
        group_id: aliceGroupId,
        customer_name: 'Alice Smith',
        phone: '8765432109',
        tool_name: 'Demolition Hammer',
        quantity: 1,
        rent_date: '2026-06-22',
        return_date: '2026-06-25',
        returned: false,
        paid: true
      }
    ];

    // C. Bob Miller (Returned & Paid)
    const bobGroupId = 'c3d0e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';
    const bobRentals = [
      {
        group_id: bobGroupId,
        customer_name: 'Bob Miller',
        phone: '7654321098',
        tool_name: 'Angle Grinder',
        quantity: 1,
        rent_date: '2026-06-10',
        return_date: '2026-06-15',
        actual_return_date: '2026-06-15',
        days: 5,
        amount: 75.00,
        returned: true,
        paid: true
      }
    ];

    // D. Charlie Brown (Returned & Unpaid -> Credits tab)
    const charlieGroupId = 'd4e1f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a';
    const charlieRentals = [
      {
        group_id: charlieGroupId,
        customer_name: 'Charlie Brown',
        phone: '6543210987',
        tool_name: 'Chainsaw',
        quantity: 1,
        rent_date: '2026-06-18',
        return_date: '2026-06-22',
        actual_return_date: '2026-06-22',
        days: 4,
        amount: 140.00, // 4 days * 35.00 * 1 qty
        returned: true,
        paid: false
      },
      {
        group_id: charlieGroupId,
        customer_name: 'Charlie Brown',
        phone: '6543210987',
        tool_name: 'Ladder 20ft',
        quantity: 1,
        rent_date: '2026-06-18',
        return_date: '2026-06-22',
        actual_return_date: '2026-06-22',
        days: 4,
        amount: 40.00, // 4 days * 10.00 * 1 qty
        returned: true,
        paid: false
      }
    ];

    const allRentals = [...johnRentals, ...aliceRentals, ...bobRentals, ...charlieRentals];
    const { data: insertedRentals, error: insertRentalsError } = await supabase
      .from('rentals')
      .insert(allRentals)
      .select();

    if (insertRentalsError) throw insertRentalsError;
    console.log(`✅ Successfully inserted ${insertedRentals.length} rentals.`);

    // 4. Decrement stock for active rentals manually in this script
    console.log('Adjusting inventory for active rentals...');
    
    // John Doe's active stock decrements
    const { error: johnStockError1 } = await supabase
      .from('tools')
      .update({ available_qty: 4 }) // Concrete Mixer originally 5, rented 1
      .eq('name', 'Concrete Mixer');
    if (johnStockError1) throw johnStockError1;

    const { error: johnStockError2 } = await supabase
      .from('tools')
      .update({ available_qty: 13 }) // Cordless Drill originally 15, rented 2
      .eq('name', 'Cordless Drill');
    if (johnStockError2) throw johnStockError2;

    // Alice Smith's active stock decrement
    const { error: aliceStockError } = await supabase
      .from('tools')
      .update({ available_qty: 7 }) // Demolition Hammer originally 8, rented 1
      .eq('name', 'Demolition Hammer');
    if (aliceStockError) throw aliceStockError;

    console.log('✅ Inventory adjustments completed.');
    console.log('\n🎉 Database populated successfully with sample tools and rentals!');

  } catch (err) {
    console.error('❌ Insertion failed:', err.message);
  }
}

populate();
