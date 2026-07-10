import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const app = new Hono<{ Bindings: { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string } }>();

app.onError((err, c) => {
  console.error('[Worker Error]:', err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

const getSupabase = (c: any) => {
  const url = c.env.SUPABASE_URL || c.env.VITE_SUPABASE_URL;
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.VITE_SUPABASE_ANON_KEY || c.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key);
};

// Helper for grouping and formatting rentals
const fetchRentalsHelper = async (supabase: any, returned: boolean, searchText: string = '') => {
  let query = supabase
    .from('rentals')
    .select('*')
    .eq('returned', returned);

  if (searchText.trim()) {
    query = query.or(`customer_name.ilike.%${searchText.trim()}%,phone.ilike.%${searchText.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const list = data || [];
  
  const groups: { [key: string]: any[] } = {};
  list.forEach((r: any) => {
    if (!groups[r.group_id]) {
      groups[r.group_id] = [];
    }
    groups[r.group_id].push(r);
  });

  const result = Object.keys(groups).map(groupId => {
    const rentals = groups[groupId];
    const first = rentals[0];
    const toolsStr = rentals
      .map((r: any) => `${r.tool_name} (x${r.quantity})`)
      .join(', ');
    const totalQty = rentals.reduce((sum: number, r: any) => sum + r.quantity, 0);
    const totalAmount = rentals.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
    const paidStatus = rentals.every((r: any) => r.paid);

    return {
      id: groupId,
      customer_name: first.customer_name,
      phone: first.phone,
      rent_date: first.rent_date,
      return_date: first.return_date,
      actual_return_date: first.actual_return_date,
      days: first.days,
      amount: totalAmount,
      returned: first.returned,
      paid: paidStatus,
      tool_name: toolsStr,
      quantity: totalQty,
      db_id: Math.max(...rentals.map((r: any) => Number(r.id))),
    };
  });

  return result.sort((a, b) => b.db_id - a.db_id);
};

// 1. Dashboard Stats
app.get('/api/dashboard-stats', async (c) => {
  const supabase = getSupabase(c);
  try {
    const { data: toolsData, error: toolsError } = await supabase
      .from('tools')
      .select('available_qty');

    if (toolsError) throw toolsError;

    const { data: rentalsData, error: rentalsError } = await supabase
      .from('rentals')
      .select('quantity')
      .eq('returned', false);

    if (rentalsError) throw rentalsError;

    const available = (toolsData || []).reduce((sum, item) => sum + Number(item.available_qty), 0);
    const rentedQty = (rentalsData || []).reduce((sum, item) => sum + Number(item.quantity), 0);

    const { data: activeGroups, error: activeGroupsError } = await supabase
      .from('rentals')
      .select('group_id')
      .eq('returned', false);

    if (activeGroupsError) throw activeGroupsError;
    const uniqueGroups = new Set((activeGroups || []).map(g => g.group_id));

    return c.json({
      total_tools: available + rentedQty,
      available_tools: available,
      active_rentals: uniqueGroups.size,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 2. Get All Tools
app.get('/api/tools', async (c) => {
  const supabase = getSupabase(c);
  try {
    const { data: toolsData, error: toolsError } = await supabase
      .from('tools')
      .select('*')
      .order('name', { ascending: true });

    if (toolsError) throw toolsError;

    const { data: rentalsData, error: rentalsError } = await supabase
      .from('rentals')
      .select('tool_name, quantity')
      .eq('returned', false);

    if (rentalsError) throw rentalsError;

    const rentedMap = new Map<string, number>();
    (rentalsData || []).forEach((r: any) => {
      const current = rentedMap.get(r.tool_name) || 0;
      rentedMap.set(r.tool_name, current + Number(r.quantity));
    });

    const tools = (toolsData || []).map(item => {
      const rentedQty = rentedMap.get(item.name) || 0;
      return {
        ...item,
        rate_per_day: Number(item.rate_per_day),
        total_qty: item.available_qty + rentedQty,
      };
    });

    return c.json(tools);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 3. Get Active/Available Tools (qty > 0)
app.get('/api/tools/active', async (c) => {
  const supabase = getSupabase(c);
  try {
    const { data: toolsData, error: toolsError } = await supabase
      .from('tools')
      .select('*')
      .gt('available_qty', 0)
      .order('name', { ascending: true });

    if (toolsError) throw toolsError;

    const { data: rentalsData, error: rentalsError } = await supabase
      .from('rentals')
      .select('tool_name, quantity')
      .eq('returned', false);

    if (rentalsError) throw rentalsError;

    const rentedMap = new Map<string, number>();
    (rentalsData || []).forEach((r: any) => {
      const current = rentedMap.get(r.tool_name) || 0;
      rentedMap.set(r.tool_name, current + Number(r.quantity));
    });

    const tools = (toolsData || []).map(item => {
      const rentedQty = rentedMap.get(item.name) || 0;
      return {
        ...item,
        rate_per_day: Number(item.rate_per_day),
        total_qty: item.available_qty + rentedQty,
      };
    });

    return c.json(tools);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 4. Add Tool
app.post('/api/tools', async (c) => {
  const supabase = getSupabase(c);
  try {
    const body = await c.req.json();
    const { name, availableQty, ratePerDay } = body;
    const { error } = await supabase
      .from('tools')
      .insert({
        name: (name || '').trim(),
        available_qty: Number(availableQty),
        rate_per_day: Number(ratePerDay),
      });

    if (error) {
      if (error.code === '23505') {
        return c.json({ error: 'A tool with this name already exists.' }, 400);
      }
      throw error;
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 5. Update Tool
app.put('/api/tools/:id', async (c) => {
  const supabase = getSupabase(c);
  try {
    const id = Number(c.req.param('id'));
    const body = await c.req.json();
    const { name, availableQty, ratePerDay } = body;
    const { error } = await supabase
      .from('tools')
      .update({
        name: (name || '').trim(),
        available_qty: Number(availableQty),
        rate_per_day: Number(ratePerDay),
      })
      .eq('id', id);

    if (error) {
      if (error.code === '23505') {
        return c.json({ error: 'A tool with this name already exists.' }, 400);
      }
      throw error;
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 6. Delete Tool
app.delete('/api/tools/:id', async (c) => {
  const supabase = getSupabase(c);
  try {
    const id = Number(c.req.param('id'));
    
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .select('name')
      .eq('id', id)
      .single();

    if (toolError) throw toolError;
    if (!tool) return c.json({ error: 'Tool not found.' }, 404);

    const { count, error: countError } = await supabase
      .from('rentals')
      .select('*', { count: 'exact', head: true })
      .eq('tool_name', tool.name)
      .eq('returned', false);

    if (countError) throw countError;
    if (count && count > 0) {
      return c.json({ error: 'This tool has active rentals and cannot be deleted.' }, 400);
    }

    const { error: deleteError } = await supabase
      .from('tools')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 7. Checkout / Rent Tools
app.post('/api/rentals', async (c) => {
  const supabase = getSupabase(c);
  try {
    const body = await c.req.json();
    const { customerName, phone, toolsList, rentDate, returnDate } = body;
    
    if (!toolsList || toolsList.length === 0) {
      return c.json({ error: 'No tools selected for rental.' }, 400);
    }

    const { data, error } = await supabase.rpc('rent_tools', {
      p_customer_name: customerName,
      p_phone: phone,
      p_rent_date: rentDate,
      p_return_date: returnDate,
      p_items: toolsList,
    });

    if (error) throw error;
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 8. Edit Active Rental Group
app.put('/api/rentals/:id/edit', async (c) => {
  const supabase = getSupabase(c);
  try {
    const groupId = c.req.param('id');
    const body = await c.req.json();
    const { customerName, phone, rentDate, returnDate, toolsList } = body;

    if (!toolsList || toolsList.length === 0) {
      return c.json({ error: 'No tools selected for rental.' }, 400);
    }

    const { error } = await supabase.rpc('edit_active_rental', {
      p_group_id: groupId,
      p_customer_name: customerName,
      p_phone: phone,
      p_rent_date: rentDate,
      p_return_date: returnDate,
      p_items: toolsList,
    });

    if (error) throw error;
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 9. Active Rentals List
app.get('/api/rentals/active', async (c) => {
  const supabase = getSupabase(c);
  const searchText = c.req.query('searchText') || '';
  try {
    const data = await fetchRentalsHelper(supabase, false, searchText);
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 10. Returned Rentals List (Bills)
app.get('/api/rentals/returned', async (c) => {
  const supabase = getSupabase(c);
  const searchText = c.req.query('searchText') || '';
  try {
    const data = await fetchRentalsHelper(supabase, true, searchText);
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 11. Tool rentals history list
app.get('/api/rentals/tool/:name', async (c) => {
  const supabase = getSupabase(c);
  try {
    const toolName = c.req.param('name');
    const { data, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('tool_name', toolName)
      .order('id', { ascending: false });

    if (error) throw error;
    return c.json((data || []).map(r => ({
      ...r,
      amount: r.amount !== null ? Number(r.amount) : null,
    })));
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 12. Get Invoice Data
app.get('/api/rentals/invoice/:groupId', async (c) => {
  const supabase = getSupabase(c);
  try {
    const groupId = c.req.param('groupId');
    const { data: rentals, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('group_id', groupId)
      .order('id', { ascending: true });

    if (error) throw error;
    if (!rentals || rentals.length === 0) return c.json(null);

    const first = rentals[0];
    const returned = first.returned;
    const rentDate = first.rent_date;
    const returnDate = returned ? (first.actual_return_date || first.return_date) : first.return_date;

    let days = 1;
    if (returned) {
      days = first.days || 1;
    } else {
      const rent = new Date(rentDate);
      const ret = new Date(returnDate);
      const diffTime = Math.abs(ret.getTime() - rent.getTime());
      days = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
    }

    const items = [];
    let totalAmount = 0;

    for (const r of rentals) {
      const { data: tool } = await supabase
        .from('tools')
        .select('rate_per_day')
        .eq('name', r.tool_name)
        .single();
      
      let rate = tool ? Number(tool.rate_per_day) : 0;
      let amount = 0;

      if (returned) {
        amount = Number(r.amount || 0);
        if (days && r.quantity && amount > 0) {
          rate = amount / (days * r.quantity);
        }
      } else {
        amount = days * r.quantity * rate;
      }

      totalAmount += amount;
      items.push({
        tool_name: r.tool_name,
        quantity: r.quantity,
        rate_per_day: rate,
        days: days,
        amount: amount,
      });
    }

    return c.json({
      bill_no: groupId.substring(0, 8).toUpperCase(),
      group_id: groupId,
      customer_name: first.customer_name,
      phone: first.phone,
      rent_date: rentDate,
      return_date: returnDate,
      days: days,
      items: items,
      amount: totalAmount,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 13. Return Rental
app.post('/api/rentals/return', async (c) => {
  const supabase = getSupabase(c);
  try {
    const body = await c.req.json();
    const { groupId, actualReturnDate, paid } = body;
    const { data, error } = await supabase.rpc('return_rental', {
      p_group_id: groupId,
      p_actual_return_date: actualReturnDate,
      p_paid: paid,
    });

    if (error) throw error;
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 14. Undo Return
app.post('/api/rentals/undo-return', async (c) => {
  const supabase = getSupabase(c);
  try {
    const body = await c.req.json();
    const { groupId } = body;
    const { error } = await supabase.rpc('undo_return_rental', {
      p_group_id: groupId,
    });

    if (error) throw error;
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 15. Update Return Date
app.put('/api/rentals/return-date', async (c) => {
  const supabase = getSupabase(c);
  try {
    const body = await c.req.json();
    const { groupId, actualReturnDate } = body;
    const { error } = await supabase.rpc('update_return_date', {
      p_group_id: groupId,
      p_actual_return_date: actualReturnDate,
    });

    if (error) throw error;
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 16. Update Payment Status
app.put('/api/rentals/payment-status', async (c) => {
  const supabase = getSupabase(c);
  try {
    const body = await c.req.json();
    const { groupId, paid } = body;
    const { error } = await supabase
      .from('rentals')
      .update({ paid })
      .eq('group_id', groupId);

    if (error) throw error;
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 17. Get Credit Customers
app.get('/api/credits', async (c) => {
  const supabase = getSupabase(c);
  const searchText = c.req.query('searchText') || '';
  try {
    let query = supabase
      .from('rentals')
      .select('*')
      .eq('returned', true)
      .eq('paid', false);

    if (searchText.trim()) {
      query = query.or(`customer_name.ilike.%${searchText.trim()}%,phone.ilike.%${searchText.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const list = data || [];
    
    const customerGroups: { [key: string]: { rentals: any[], totalCredit: number } } = {};
    list.forEach((r: any) => {
      const key = `${r.customer_name.trim()}::${r.phone.trim()}`;
      if (!customerGroups[key]) {
        customerGroups[key] = { rentals: [], totalCredit: 0 };
      }
      customerGroups[key].rentals.push(r);
      customerGroups[key].totalCredit += Number(r.amount || 0);
    });

    const result = Object.keys(customerGroups).map(key => {
      const group = customerGroups[key];
      const [custName, phone] = key.split('::');
      const uniqueBills = new Set(group.rentals.map((r: any) => r.group_id)).size;
      const toolsStr = group.rentals
        .map((r: any) => `${r.tool_name} (x${r.quantity})`)
        .join(', ');

      return {
        customer_name: custName,
        phone: phone,
        total_credit: group.totalCredit,
        bill_count: uniqueBills,
        tools: toolsStr,
        max_db_id: Math.max(...group.rentals.map((r: any) => Number(r.id))),
      };
    }).sort((a, b) => b.max_db_id - a.max_db_id);

    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 18. Get Customer Unpaid Rentals
app.get('/api/credits/unpaid', async (c) => {
  const supabase = getSupabase(c);
  const customerName = c.req.query('customerName') || '';
  const phone = c.req.query('phone') || '';
  try {
    const { data, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('returned', true)
      .eq('paid', false)
      .eq('customer_name', customerName)
      .eq('phone', phone);

    if (error) throw error;
    const list = data || [];

    const groups: { [key: string]: any[] } = {};
    list.forEach((r: any) => {
      if (!groups[r.group_id]) {
        groups[r.group_id] = [];
      }
      groups[r.group_id].push(r);
    });

    const result = Object.keys(groups).map(groupId => {
      const rentals = groups[groupId];
      const first = rentals[0];
      const toolsStr = rentals
        .map((r: any) => `${r.tool_name} (x${r.quantity})`)
        .join(', ');
      const totalQty = rentals.reduce((sum: number, r: any) => sum + r.quantity, 0);
      const totalAmount = rentals.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

      return {
        id: groupId,
        customer_name: first.customer_name,
        phone: first.phone,
        rent_date: first.rent_date,
        return_date: first.return_date,
        actual_return_date: first.actual_return_date,
        days: first.days,
        amount: totalAmount,
        returned: first.returned,
        paid: first.paid,
        tool_name: toolsStr,
        quantity: totalQty,
        db_id: Math.max(...rentals.map((r: any) => Number(r.id))),
      };
    }).sort((a, b) => b.db_id - a.db_id);

    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 19. Settle Customer Dues (Mark All as Paid)
app.post('/api/credits/pay-all', async (c) => {
  const supabase = getSupabase(c);
  try {
    const body = await c.req.json();
    const { customerName, phone } = body;
    const { error } = await supabase
      .from('rentals')
      .update({ paid: true })
      .eq('customer_name', customerName)
      .eq('phone', phone)
      .eq('returned', true)
      .eq('paid', false);

    if (error) throw error;
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 20. Get Combined Credit Invoice Data
app.get('/api/credits/combined-invoice', async (c) => {
  const supabase = getSupabase(c);
  const customerName = c.req.query('customerName') || '';
  const phone = c.req.query('phone') || '';
  try {
    const { data: rentals, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('customer_name', customerName)
      .eq('phone', phone)
      .eq('returned', true)
      .eq('paid', false)
      .order('group_id', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;
    if (!rentals || rentals.length === 0) return c.json(null);

    const billNos = Array.from(new Set(rentals.map((r: any) => r.group_id.substring(0, 8).toUpperCase())));
    const billNosStr = billNos.join(', ');

    const rentDates = rentals.map((r: any) => new Date(r.rent_date));
    const returnDates = rentals.map((r: any) => new Date(r.actual_return_date || r.return_date));

    const earliestRent = new Date(Math.min(...rentDates.map(d => d.getTime()))).toISOString().split('T')[0];
    const latestReturn = new Date(Math.max(...returnDates.map(d => d.getTime()))).toISOString().split('T')[0];

    const items = [];
    let totalAmount = 0;

    for (const r of rentals) {
      const { data: tool } = await supabase
        .from('tools')
        .select('rate_per_day')
        .eq('name', r.tool_name)
        .single();
      
      let rate = tool ? Number(tool.rate_per_day) : 0;
      const amount = Number(r.amount || 0);
      const days = r.days || 1;
      
      if (days && r.quantity && amount > 0) {
        rate = amount / (days * r.quantity);
      }

      totalAmount += amount;
      const formattedRentDate = r.rent_date.split('-').reverse().join('/');
      const formattedReturnDate = (r.actual_return_date || r.return_date).split('-').reverse().join('/');
      const desc = `${r.tool_name} (${formattedRentDate} to ${formattedReturnDate})`;

      items.push({
        tool_name: desc,
        quantity: r.quantity,
        rate_per_day: rate,
        days: days,
        amount: amount,
      });
    }

    return c.json({
      bill_no: `Combined (${billNosStr})`,
      customer_name: customerName,
      phone: phone,
      rent_date: earliestRent,
      return_date: latestReturn,
      days: rentals.reduce((sum, r) => sum + (r.days || 0), 0),
      items: items,
      amount: totalAmount,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 21. Get All Unique Customers
app.get('/api/customers', async (c) => {
  const supabase = getSupabase(c);
  try {
    const { data, error } = await supabase
      .from('rentals')
      .select('customer_name, phone');

    if (error) throw error;

    // Deduplicate by phone number to yield a unique customer list
    const customerMap = new Map<string, string>();
    (data || []).forEach((r: any) => {
      const name = (r.customer_name || '').trim();
      const phone = (r.phone || '').trim();
      if (name && phone) {
        customerMap.set(phone, name);
      }
    });

    const customers = Array.from(customerMap.entries()).map(([phone, customer_name]) => ({
      customer_name,
      phone,
    })).sort((a, b) => a.customer_name.localeCompare(b.customer_name));

    return c.json(customers);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
