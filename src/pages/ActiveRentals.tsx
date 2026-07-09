import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../utils/db';
import type { GroupedRental, Tool } from '../utils/db';
import { Check, Printer, FileText, Edit, Trash2, ArrowDown, MessageCircle } from 'lucide-react';


interface ActiveRentalsProps {
  onPrint: (data: any) => void;
}

export const ActiveRentals: React.FC<ActiveRentalsProps> = ({ onPrint }) => {
  const { tr } = useLanguage();
  const [rentals, setRentals] = useState<GroupedRental[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedRental, setSelectedRental] = useState<GroupedRental | null>(null);
  
  const [rentalItems, setRentalItems] = useState<{ tool_name: string; quantity: number }[]>([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [actualReturnDate, setActualReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isPaid, setIsPaid] = useState(true);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRentDate, setEditRentDate] = useState('');
  const [editReturnDate, setEditReturnDate] = useState('');
  const [editCart, setEditCart] = useState<{ name: string; qty: number; rate: number }[]>([]);
  const [editQty, setEditQty] = useState(1);
  const [editSelectedToolName, setEditSelectedToolName] = useState('');
  const [availableActiveTools, setAvailableActiveTools] = useState<Tool[]>([]);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRentals = async () => {
    try {
      const data = await db.activeRentals(searchText);
      setRentals(data);
      // Reset details if the selected group is no longer in list
      if (selectedRental) {
        const stillExists = data.find(r => r.id === selectedRental.id);
        if (!stillExists) {
          setSelectedRental(null);
          setRentalItems([]);
        }
      }
    } catch (err: any) {
      showMsg(err.message || 'Failed to fetch rentals.', 'error');
    }
  };

  useEffect(() => {
    fetchRentals().finally(() => setLoading(false));
  }, [searchText]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage(null);
    }, 5000);
  };

  const handleRowClick = async (rental: GroupedRental) => {
    setSelectedRental(rental);
    try {
      const invoice = await db.getInvoiceData(rental.id);
      if (invoice) {
        setRentalItems(invoice.items);
      }
    } catch (err: any) {
      showMsg('Failed to load rental items.', 'error');
    }
  };

  const handleOpenReturn = () => {
    if (!selectedRental) {
      showMsg(tr('select_rental_first'), 'error');
      return;
    }
    // Set default date to expected return date (return_date) or today
    setActualReturnDate(selectedRental.return_date || new Date().toISOString().split('T')[0]);
    setIsPaid(true);
    setShowReturnModal(true);
  };

  const submitReturn = async () => {
    if (!selectedRental) return;

    try {
      const summary: any = await db.returnRental(selectedRental.id, actualReturnDate, isPaid);
      setShowReturnModal(false);
      
      const successText = `${tr('rental_returned')} | ${tr('days')}: ${summary[0]?.days || summary[0]?.out_days || 1} | ${tr('amount')}: ₹${Number(summary[0]?.amount || summary[0]?.out_amount || 0).toFixed(2)}`;
      showMsg(successText, 'success');
      
      fetchRentals();
    } catch (err: any) {
      showMsg(err.message || 'Failed to return tools.', 'error');
    }
  };

  const handlePrint = async () => {
    if (!selectedRental) {
      showMsg(tr('select_rental_first'), 'error');
      return;
    }
    try {
      const data = await db.getInvoiceData(selectedRental.id);
      if (data) {
        onPrint(data);
      }
    } catch (err: any) {
      showMsg('Failed to generate invoice.', 'error');
    }
  };

  const handleWhatsAppShare = async () => {
    if (!selectedRental) {
      showMsg(tr('select_rental_first'), 'error');
      return;
    }
    try {
      const data = await db.getInvoiceData(selectedRental.id);
      if (data) {
        const formatDateStr = (dateStr: string) => {
          if (!dateStr) return '';
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          return dateStr;
        };

        let msg = `*${tr('app_name')}*\n`;
        msg += `_${tr('shop_location')}_\n`;
        msg += `_${tr('shop_phone')}_\n\n`;
        msg += `*${tr('active_rentals')} Invoice / Estimate*\n\n`;
        msg += `*Bill No:* ${data.bill_no}\n`;
        msg += `*Customer:* ${data.customer_name}\n`;
        msg += `*Phone:* ${data.phone}\n`;
        msg += `*Rent Date:* ${formatDateStr(data.rent_date)}\n`;
        msg += `*Expected Return:* ${formatDateStr(data.return_date)}\n\n`;
        msg += `*Items:*\n`;
        data.items.forEach((item: any) => {
          msg += `- ${item.tool_name} x ${item.quantity} (₹${item.rate_per_day.toFixed(2)}/day for ${item.days} days): ₹${item.amount.toFixed(2)}\n`;
        });
        msg += `\n*Estimated Total:* ₹${data.amount.toFixed(2)}\n\n`;
        msg += `Thank you for choosing ${tr('app_name')}.`;

        let cleanedPhone = data.phone.replace(/\D/g, '');
        if (cleanedPhone.length === 10) {
          cleanedPhone = '91' + cleanedPhone;
        }

        const link = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(msg)}`;
        window.open(link, '_blank');
      }
    } catch (err: any) {
      showMsg('Failed to generate WhatsApp message.', 'error');
    }
  };

  const handleOpenEdit = async () => {
    if (!selectedRental) {
      showMsg(tr('select_rental_first'), 'error');
      return;
    }
    try {
      const tools = await db.allTools();
      setAvailableActiveTools(tools);
      if (tools.length > 0) {
        setEditSelectedToolName(tools[0].name);
      }

      setEditCustomer(selectedRental.customer_name);
      setEditPhone(selectedRental.phone);
      setEditRentDate(selectedRental.rent_date);
      setEditReturnDate(selectedRental.return_date);

      const mappedCart = rentalItems.map(item => {
        const toolInfo = tools.find(t => t.name === item.tool_name);
        return {
          name: item.tool_name,
          qty: item.quantity,
          rate: toolInfo ? toolInfo.rate_per_day : 0
        };
      });
      setEditCart(mappedCart);
      setEditQty(1);
      setShowEditModal(true);
    } catch (err: any) {
      showMsg('Failed to load tools for editing.', 'error');
    }
  };

  const handleAddToEditCart = () => {
    if (!editSelectedToolName) {
      showMsg('Select a tool first.', 'error');
      return;
    }
    const toolInfo = availableActiveTools.find(t => t.name === editSelectedToolName);
    if (!toolInfo) return;

    if (editQty <= 0) {
      showMsg('Quantity must be greater than zero.', 'error');
      return;
    }

    const existingInRental = rentalItems.find(item => item.tool_name === editSelectedToolName);
    const existingInRentalQty = existingInRental ? existingInRental.quantity : 0;
    
    const existingInEditCart = editCart.find(item => item.name === editSelectedToolName);
    const existingInEditCartQty = existingInEditCart ? existingInEditCart.qty : 0;
    
    const totalContextAvailable = toolInfo.available_qty + existingInRentalQty;
    const totalNewRequested = existingInEditCartQty + editQty;

    if (totalContextAvailable < totalNewRequested) {
      showMsg(`Only ${totalContextAvailable} units of ${editSelectedToolName} are available.`, 'error');
      return;
    }

    if (existingInEditCart) {
      setEditCart(editCart.map(item => 
        item.name === editSelectedToolName 
          ? { ...item, qty: item.qty + editQty }
          : item
      ));
    } else {
      setEditCart([...editCart, {
        name: editSelectedToolName,
        qty: editQty,
        rate: toolInfo.rate_per_day
      }]);
    }

    setEditQty(1);
  };

  const handleRemoveFromEditCart = (index: number) => {
    setEditCart(editCart.filter((_, idx) => idx !== index));
  };

  const handleSaveEdit = async () => {
    if (!selectedRental) return;
    if (!editCustomer.trim()) {
      showMsg(tr('enter_customer_name'), 'error');
      return;
    }
    if (!editPhone.trim()) {
      showMsg(tr('enter_phone_number'), 'error');
      return;
    }
    if (editCart.length === 0) {
      showMsg(tr('add_tool_first'), 'error');
      return;
    }
    if (new Date(editReturnDate) < new Date(editRentDate)) {
      showMsg(tr('return_before_rent'), 'error');
      return;
    }

    try {
      const items = editCart.map(item => ({ name: item.name, qty: item.qty }));
      await db.editActiveRental(
        selectedRental.id,
        editCustomer,
        editPhone,
        editRentDate,
        editReturnDate,
        items
      );
      showMsg('Rental updated successfully.', 'success');
      setShowEditModal(false);
      
      // Refresh rentals list
      await fetchRentals();
      
      // Re-fetch items for the updated selection
      const invoice = await db.getInvoiceData(selectedRental.id);
      if (invoice) {
        setRentalItems(invoice.items);
      }
    } catch (err: any) {
      showMsg(err.message || 'Failed to update rental.', 'error');
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split('-').reverse().join('/');
  };

  if (loading) {
    return <div className="page-container"><div>Loading...</div></div>;
  }

  return (
    <div className="page-container">
      <h1 className="page-title">{tr('active_rentals')}</h1>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-warning'}`}>
          {message.text}
        </div>
      )}

      {/* Split layout */}
      <div className="split-layout">
        {/* Left Column (Search, Table, Buttons) */}
        <div className="split-left">
          <input
            type="text"
            className="search-input"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={tr('active_rentals_search')}
            style={{ width: '100%' }}
          />

          <div className="table-container" style={{ flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th>{tr('customer_name')}</th>
                  <th>{tr('phone_number')}</th>
                  <th>{tr('tool_name')}</th>
                  <th>{tr('quantity')}</th>
                  <th>{tr('rent_date')}</th>
                  <th>{tr('expected_return_date')}</th>
                </tr>
              </thead>
              <tbody>
                {rentals.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No active rentals found.
                    </td>
                  </tr>
                ) : (
                  rentals.map((r) => (
                    <tr
                      key={r.id}
                      className={selectedRental?.id === r.id ? 'selected' : ''}
                      onClick={() => handleRowClick(r)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{r.customer_name}</td>
                      <td>{r.phone}</td>
                      <td>{r.tool_name}</td>
                      <td>{r.quantity}</td>
                      <td>{formatDate(r.rent_date)}</td>
                      <td>{formatDate(r.return_date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleOpenReturn} disabled={!selectedRental}>
              <Check size={16} />
              {tr('return_tool')}
            </button>
            <button className="btn" onClick={handleOpenEdit} disabled={!selectedRental}>
              <Edit size={16} />
              {tr('edit_rental') || 'Edit Rental'}
            </button>
            <button className="btn" onClick={handlePrint} disabled={!selectedRental}>
              <Printer size={16} />
              {tr('print_preview')}
            </button>
            <button className="btn" onClick={handlePrint} disabled={!selectedRental}>
              <FileText size={16} />
              {tr('save_pdf')}
            </button>
            <button className="btn btn-whatsapp" onClick={handleWhatsAppShare} disabled={!selectedRental}>
              <MessageCircle size={16} />
              {tr('share_whatsapp')}
            </button>
          </div>
        </div>

        {/* Right Column (Details sidebar) */}
        <div className="split-right">
          <div className="details-title">{tr('rental_details')}</div>

          {!selectedRental ? (
            <div className="placeholder_label" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)' }}>
              {tr('select_rental_details')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <strong>{tr('customer_name')}:</strong> {selectedRental.customer_name}
              </div>
              <div>
                <strong>{tr('phone_number')}:</strong> {selectedRental.phone}
              </div>
              <div>
                <strong>{tr('rent_date')}:</strong> {formatDate(selectedRental.rent_date)}
              </div>

              <div style={{ fontWeight: '700', marginTop: '8px' }}>{tr('tools_taken')}</div>
              <div className="table-container" style={{ maxHeight: '240px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tr('tool_name')}</th>
                      <th style={{ textAlign: 'right' }}>{tr('quantity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rentalItems.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.tool_name}</td>
                        <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Return Tool Modal */}
      {showReturnModal && selectedRental && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title">{tr('return_tool')}</div>

            <div className="form-group">
              <label>{tr('actual_return_date')}</label>
              <input
                type="date"
                value={actualReturnDate}
                onChange={(e) => setActualReturnDate(e.target.value)}
              />
            </div>

            {/* Paid/Unpaid toggle button */}
            <div className="form-group" style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className={`toggle-btn ${isPaid ? 'paid' : 'unpaid'}`}
                onClick={() => setIsPaid(!isPaid)}
              >
                {isPaid ? `✓ ${tr('paid')}` : `⚠ ${tr('not_paid')}`}
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowReturnModal(false)}>{tr('close')}</button>
              <button className="btn btn-primary" onClick={submitReturn}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rental Modal */}
      {showEditModal && selectedRental && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', width: '95%' }}>
            <div className="modal-title">{tr('edit_rental') || 'Edit Rental'}</div>

            <div className="form-row">
              <div className="form-group">
                <label>{tr('customer_name')}</label>
                <input
                  type="text"
                  value={editCustomer}
                  onChange={(e) => setEditCustomer(e.target.value)}
                  placeholder={tr('customer_name')}
                />
              </div>
              <div className="form-group">
                <label>{tr('phone_number')}</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder={tr('phone_number')}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{tr('rent_date')}</label>
                <input
                  type="date"
                  value={editRentDate}
                  onChange={(e) => setEditRentDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>{tr('expected_return_date')}</label>
                <input
                  type="date"
                  value={editReturnDate}
                  onChange={(e) => setEditReturnDate(e.target.value)}
                />
              </div>
            </div>

            {/* Tool Selection Row inside Edit */}
            <div className="form-group">
              <label>{tr('tool')}</label>
              <div className="tool-add-row">
                <select
                  value={editSelectedToolName}
                  onChange={(e) => setEditSelectedToolName(e.target.value)}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  {availableActiveTools.length === 0 ? (
                    <option value="">No tools available</option>
                  ) : (
                    availableActiveTools.map((t) => {
                      const existingInRental = rentalItems.find(item => item.tool_name === t.name);
                      const originalQty = existingInRental ? existingInRental.quantity : 0;
                      const displayQty = t.available_qty + originalQty;
                      return (
                        <option key={t.id} value={t.name}>
                          {t.name} - Available: {displayQty} - Rate: ₹{t.rate_per_day.toFixed(2)}/day
                        </option>
                      );
                    })
                  )}
                </select>
                <input
                  type="number"
                  min="1"
                  value={editQty}
                  onChange={(e) => setEditQty(Number(e.target.value))}
                  style={{ width: '85px', textAlign: 'center' }}
                />
                <button type="button" className="btn" onClick={handleAddToEditCart}>
                  <ArrowDown size={16} />
                  {tr('add_to_list')}
                </button>
              </div>
            </div>

            {/* Edit Cart list */}
            <div className="cart-table-container" style={{ minHeight: '100px', maxHeight: '200px' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tr('tool_name')}</th>
                    <th>{tr('quantity')}</th>
                    <th>{tr('rate_per_day')}</th>
                    <th style={{ width: '80px' }}>{tr('action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {editCart.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        {tr('cart_empty')}
                      </td>
                    </tr>
                  ) : (
                    editCart.map((item, index) => (
                      <tr key={index}>
                        <td>{item.name}</td>
                        <td>{item.qty}</td>
                        <td>{item.rate.toFixed(2)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '4px 8px', minHeight: 'auto' }}
                            onClick={() => handleRemoveFromEditCart(index)}
                          >
                            <Trash2 size={14} />
                            {tr('remove')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowEditModal(false)}>{tr('close')}</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>{tr('clear') === 'വെടിപ്പാക്കുക' ? 'സൂക്ഷിക്കുക' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
