import { supabase } from './supabaseClient';

export interface Tool {
  id: number;
  name: string;
  available_qty: number;
  rate_per_day: number;
}

export interface Rental {
  id: number;
  group_id: string;
  customer_name: string;
  phone: string;
  tool_name: string;
  quantity: number;
  rent_date: string;
  return_date: string;
  actual_return_date: string | null;
  days: number | null;
  amount: number | null;
  returned: boolean;
  paid: boolean;
}

export interface GroupedRental {
  id: string; // group_id
  customer_name: string;
  phone: string;
  rent_date: string;
  return_date: string;
  actual_return_date: string | null;
  days: number | null;
  amount: number;
  returned: boolean;
  paid: boolean;
  tool_name: string; // aggregated name string, e.g. "Hammer (x1), Drill (x2)"
  quantity: number; // total quantity
}

export interface CreditCustomer {
  customer_name: string;
  phone: string;
  total_credit: number;
  bill_count: number;
  tools: string;
}

export const db = {
  async dashboardStats() {
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

    // active rentals are unique groups that are not returned
    const { data: activeGroups, error: activeGroupsError } = await supabase
      .from('rentals')
      .select('group_id')
      .eq('returned', false);

    if (activeGroupsError) throw activeGroupsError;
    const uniqueGroups = new Set((activeGroups || []).map(g => g.group_id));

    return {
      total_tools: available + rentedQty,
      available_tools: available,
      active_rentals: uniqueGroups.size,
    };
  },

  async allTools(): Promise<Tool[]> {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(item => ({
      ...item,
      rate_per_day: Number(item.rate_per_day),
    }));
  },

  async activeTools(): Promise<Tool[]> {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .gt('available_qty', 0)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(item => ({
      ...item,
      rate_per_day: Number(item.rate_per_day),
    }));
  },

  async addTool(name: string, availableQty: number, ratePerDay: number) {
    const { error } = await supabase
      .from('tools')
      .insert({
        name: name.trim(),
        available_qty: availableQty,
        rate_per_day: ratePerDay,
      });

    if (error) {
      if (error.code === '23505') {
        throw new Error('A tool with this name already exists.');
      }
      throw error;
    }
  },

  async updateTool(toolId: number, name: string, availableQty: number, ratePerDay: number) {
    const { error } = await supabase
      .from('tools')
      .update({
        name: name.trim(),
        available_qty: availableQty,
        rate_per_day: ratePerDay,
      })
      .eq('id', toolId);

    if (error) {
      if (error.code === '23505') {
        throw new Error('A tool with this name already exists.');
      }
      throw error;
    }
  },

  async deleteTool(toolId: number) {
    // 1. Get tool name
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .select('name')
      .eq('id', toolId)
      .single();

    if (toolError) throw toolError;
    if (!tool) throw new Error('Tool not found.');

    // 2. Check active rentals
    const { count, error: countError } = await supabase
      .from('rentals')
      .select('*', { count: 'exact', head: true })
      .eq('tool_name', tool.name)
      .eq('returned', false);

    if (countError) throw countError;
    if (count && count > 0) {
      throw new Error('This tool has active rentals and cannot be deleted.');
    }

    // 3. Delete tool
    const { error: deleteError } = await supabase
      .from('tools')
      .delete()
      .eq('id', toolId);

    if (deleteError) throw deleteError;
  },

  async rentTools(customerName: string, phone: string, toolsList: { name: string, qty: number }[], rentDate: string, returnDate: string) {
    if (!toolsList || toolsList.length === 0) {
      throw new Error('No tools selected for rental.');
    }

    const { data, error } = await supabase.rpc('rent_tools', {
      p_customer_name: customerName,
      p_phone: phone,
      p_rent_date: rentDate,
      p_return_date: returnDate,
      p_items: toolsList,
    });

    if (error) {
      throw new Error(error.message);
    }
    return data as string; // returns group_id
  },

  async editActiveRental(groupId: string, customerName: string, phone: string, rentDate: string, returnDate: string, toolsList: { name: string, qty: number }[]) {
    if (!toolsList || toolsList.length === 0) {
      throw new Error('No tools selected for rental.');
    }

    const { error } = await supabase.rpc('edit_active_rental', {
      p_group_id: groupId,
      p_customer_name: customerName,
      p_phone: phone,
      p_rent_date: rentDate,
      p_return_date: returnDate,
      p_items: toolsList,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async activeRentals(searchText: string = ''): Promise<GroupedRental[]> {
    return this._rentals(false, searchText);
  },

  async returnedRentals(searchText: string = ''): Promise<GroupedRental[]> {
    return this._rentals(true, searchText);
  },

  async toolRentals(toolName: string): Promise<Rental[]> {
    const { data, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('tool_name', toolName)
      .order('id', { ascending: false });

    if (error) throw error;
    return (data || []).map(r => ({
      ...r,
      amount: r.amount !== null ? Number(r.amount) : null,
    }));
  },

  async _rentals(returned: boolean, searchText: string = ''): Promise<GroupedRental[]> {
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
    
    // Group by group_id in JS
    const groups: { [key: string]: Rental[] } = {};
    list.forEach(r => {
      if (!groups[r.group_id]) {
        groups[r.group_id] = [];
      }
      groups[r.group_id].push(r);
    });

    const result: GroupedRental[] = Object.keys(groups).map(groupId => {
      const rentals = groups[groupId];
      const first = rentals[0];
      const toolsStr = rentals
        .map(r => `${r.tool_name} (x${r.quantity})`)
        .join(', ');
      const totalQty = rentals.reduce((sum, r) => sum + r.quantity, 0);
      const totalAmount = rentals.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const paidStatus = rentals.every(r => r.paid);

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
      };
    });

    // Sort by group ID / id of the first element desc to replicate ORDER BY group_id DESC
    return result.sort((a, b) => b.id.localeCompare(a.id));
  },

  async getInvoiceData(groupId: string) {
    const { data: rentals, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('group_id', groupId)
      .order('id', { ascending: true });

    if (error) throw error;
    if (!rentals || rentals.length === 0) return null;

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
      days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    const items = [];
    let totalAmount = 0;

    // Fetch tool rates in a batch or parallel
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

    return {
      bill_no: groupId.substring(0, 8).toUpperCase(), // Short representation of UUID
      group_id: groupId,
      customer_name: first.customer_name,
      phone: first.phone,
      rent_date: rentDate,
      return_date: returnDate,
      days: days,
      items: items,
      amount: totalAmount,
    };
  },

  async returnRental(groupId: string, actualReturnDate: string, paid: boolean) {
    const { data, error } = await supabase.rpc('return_rental', {
      p_group_id: groupId,
      p_actual_return_date: actualReturnDate,
      p_paid: paid,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async undoReturnRental(groupId: string) {
    const { error } = await supabase.rpc('undo_return_rental', {
      p_group_id: groupId,
    });
    if (error) throw new Error(error.message);
  },

  async updateReturnDate(groupId: string, actualReturnDate: string) {
    const { error } = await supabase.rpc('update_return_date', {
      p_group_id: groupId,
      p_actual_return_date: actualReturnDate,
    });
    if (error) throw new Error(error.message);
  },

  async setPaymentStatus(groupId: string, paid: boolean) {
    const { error } = await supabase
      .from('rentals')
      .update({ paid })
      .eq('group_id', groupId);

    if (error) throw error;
  },

  async getCreditCustomers(searchText: string = ''): Promise<CreditCustomer[]> {
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
    
    // Group by customer_name and phone in JS
    const customerGroups: { [key: string]: { rentals: Rental[], totalCredit: number } } = {};
    list.forEach(r => {
      const key = `${r.customer_name.trim()}::${r.phone.trim()}`;
      if (!customerGroups[key]) {
        customerGroups[key] = { rentals: [], totalCredit: 0 };
      }
      customerGroups[key].rentals.push(r);
      customerGroups[key].totalCredit += Number(r.amount || 0);
    });

    return Object.keys(customerGroups).map(key => {
      const group = customerGroups[key];
      const [custName, phone] = key.split('::');
      const uniqueBills = new Set(group.rentals.map(r => r.group_id)).size;
      const toolsStr = group.rentals
        .map(r => `${r.tool_name} (x${r.quantity})`)
        .join(', ');

      return {
        customer_name: custName,
        phone: phone,
        total_credit: group.totalCredit,
        bill_count: uniqueBills,
        tools: toolsStr,
      };
    }).sort((a, b) => a.customer_name.localeCompare(b.customer_name));
  },

  async getCustomerUnpaidRentals(customerName: string, phone: string): Promise<GroupedRental[]> {
    const { data, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('returned', true)
      .eq('paid', false)
      .eq('customer_name', customerName)
      .eq('phone', phone);

    if (error) throw error;
    const list = data || [];

    // Group by group_id in JS
    const groups: { [key: string]: Rental[] } = {};
    list.forEach(r => {
      if (!groups[r.group_id]) {
        groups[r.group_id] = [];
      }
      groups[r.group_id].push(r);
    });

    return Object.keys(groups).map(groupId => {
      const rentals = groups[groupId];
      const first = rentals[0];
      const toolsStr = rentals
        .map(r => `${r.tool_name} (x${r.quantity})`)
        .join(', ');
      const totalQty = rentals.reduce((sum, r) => sum + r.quantity, 0);
      const totalAmount = rentals.reduce((sum, r) => sum + Number(r.amount || 0), 0);

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
      };
    }).sort((a, b) => b.id.localeCompare(a.id));
  },

  async markCustomerAsPaid(customerName: string, phone: string) {
    const { error } = await supabase
      .from('rentals')
      .update({ paid: true })
      .eq('customer_name', customerName)
      .eq('phone', phone)
      .eq('returned', true)
      .eq('paid', false);

    if (error) throw error;
  },

  async getCombinedInvoiceData(customerName: string, phone: string) {
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
    if (!rentals || rentals.length === 0) return null;

    const billNos = Array.from(new Set(rentals.map(r => r.group_id.substring(0, 8).toUpperCase())));
    const billNosStr = billNos.join(', ');

    const rentDates = rentals.map(r => new Date(r.rent_date));
    const returnDates = rentals.map(r => new Date(r.actual_return_date || r.return_date));

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

    return {
      bill_no: `Combined (${billNosStr})`,
      customer_name: customerName,
      phone: phone,
      rent_date: earliestRent,
      return_date: latestReturn,
      days: rentals.reduce((sum, r) => sum + (r.days || 0), 0),
      items: items,
      amount: totalAmount,
    };
  }
};
