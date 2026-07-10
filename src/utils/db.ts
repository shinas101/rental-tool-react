export interface Tool {
  id: number;
  name: string;
  available_qty: number;
  rate_per_day: number;
  total_qty?: number;
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

export interface Customer {
  customer_name: string;
  phone: string;
}

const fetchJson = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP error! status: ${res.status}`);
  }
  return data;
};

export const db = {
  async dashboardStats() {
    return fetchJson('/api/dashboard-stats');
  },

  async allTools(): Promise<Tool[]> {
    return fetchJson('/api/tools');
  },

  async activeTools(): Promise<Tool[]> {
    return fetchJson('/api/tools/active');
  },

  async addTool(name: string, availableQty: number, ratePerDay: number) {
    return fetchJson('/api/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, availableQty: Number(availableQty), ratePerDay: Number(ratePerDay) }),
    });
  },

  async updateTool(toolId: number, name: string, availableQty: number, ratePerDay: number) {
    return fetchJson(`/api/tools/${toolId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, availableQty: Number(availableQty), ratePerDay: Number(ratePerDay) }),
    });
  },

  async deleteTool(toolId: number) {
    return fetchJson(`/api/tools/${toolId}`, {
      method: 'DELETE',
    });
  },

  async rentTools(customerName: string, phone: string, toolsList: { name: string, qty: number }[], rentDate: string, returnDate: string) {
    return fetchJson('/api/rentals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName, phone, toolsList, rentDate, returnDate }),
    });
  },

  async editActiveRental(groupId: string, customerName: string, phone: string, rentDate: string, returnDate: string, toolsList: { name: string, qty: number }[]) {
    return fetchJson(`/api/rentals/${groupId}/edit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName, phone, rentDate, returnDate, toolsList }),
    });
  },

  async activeRentals(searchText: string = ''): Promise<GroupedRental[]> {
    return fetchJson(`/api/rentals/active?searchText=${encodeURIComponent(searchText)}`);
  },

  async returnedRentals(searchText: string = ''): Promise<GroupedRental[]> {
    return fetchJson(`/api/rentals/returned?searchText=${encodeURIComponent(searchText)}`);
  },

  async toolRentals(toolName: string): Promise<Rental[]> {
    return fetchJson(`/api/rentals/tool/${encodeURIComponent(toolName)}`);
  },

  async getInvoiceData(groupId: string) {
    return fetchJson(`/api/rentals/invoice/${groupId}`);
  },

  async returnRental(groupId: string, actualReturnDate: string, paid: boolean) {
    return fetchJson('/api/rentals/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, actualReturnDate, paid }),
    });
  },

  async undoReturnRental(groupId: string) {
    return fetchJson('/api/rentals/undo-return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId }),
    });
  },

  async deleteRental(groupId: string) {
    return fetchJson(`/api/rentals/${groupId}`, {
      method: 'DELETE',
    });
  },

  async updateReturnDate(groupId: string, actualReturnDate: string) {
    return fetchJson('/api/rentals/return-date', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, actualReturnDate }),
    });
  },

  async setPaymentStatus(groupId: string, paid: boolean) {
    return fetchJson('/api/rentals/payment-status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, paid }),
    });
  },

  async getCreditCustomers(searchText: string = ''): Promise<CreditCustomer[]> {
    return fetchJson(`/api/credits?searchText=${encodeURIComponent(searchText)}`);
  },

  async getCustomerUnpaidRentals(customerName: string, phone: string): Promise<GroupedRental[]> {
    return fetchJson(`/api/credits/unpaid?customerName=${encodeURIComponent(customerName)}&phone=${encodeURIComponent(phone)}`);
  },

  async markCustomerAsPaid(customerName: string, phone: string) {
    return fetchJson('/api/credits/pay-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName, phone }),
    });
  },

  async getCombinedInvoiceData(customerName: string, phone: string) {
    return fetchJson(`/api/credits/combined-invoice?customerName=${encodeURIComponent(customerName)}&phone=${encodeURIComponent(phone)}`);
  },

  async getCustomers(): Promise<Customer[]> {
    return fetchJson('/api/customers');
  }
};
