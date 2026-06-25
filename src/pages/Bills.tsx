import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../utils/db';
import type { GroupedRental } from '../utils/db';
import { Printer, FileText, Calendar, RotateCcw, HelpCircle } from 'lucide-react';

interface BillsProps {
  onPrint: (data: any) => void;
}

export const Bills: React.FC<BillsProps> = ({ onPrint }) => {
  const { tr } = useLanguage();
  const [bills, setBills] = useState<GroupedRental[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedBill, setSelectedBill] = useState<GroupedRental | null>(null);

  const [showDateModal, setShowDateModal] = useState(false);
  const [newReturnDate, setNewReturnDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBills = async () => {
    try {
      const data = await db.returnedRentals(searchText);
      setBills(data);
      if (selectedBill) {
        const stillExists = data.find(b => b.id === selectedBill.id);
        if (stillExists) {
          setSelectedBill(stillExists);
        } else {
          setSelectedBill(null);
        }
      } else if (data.length > 0) {
        setSelectedBill(data[0]);
      }
    } catch (err: any) {
      showMsg(err.message || 'Failed to fetch bills.', 'error');
    }
  };

  useEffect(() => {
    fetchBills().finally(() => setLoading(false));
  }, [searchText]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage(null);
    }, 5000);
  };

  const handleRowClick = (bill: GroupedRental) => {
    setSelectedBill(bill);
  };

  const handlePrint = async () => {
    if (!selectedBill) {
      alert(tr('select_bill_first'));
      return;
    }
    try {
      const data = await db.getInvoiceData(selectedBill.id);
      if (data) {
        onPrint(data);
      }
    } catch (err: any) {
      showMsg('Failed to fetch invoice data.', 'error');
    }
  };

  const handleOpenEditDate = () => {
    if (!selectedBill) {
      alert(tr('select_bill_first'));
      return;
    }
    setNewReturnDate(selectedBill.actual_return_date || new Date().toISOString().split('T')[0]);
    setShowDateModal(true);
  };

  const submitEditDate = async () => {
    if (!selectedBill) return;
    try {
      await db.updateReturnDate(selectedBill.id, newReturnDate);
      setShowDateModal(false);
      showMsg(tr('return_date_updated'), 'success');
      fetchBills();
    } catch (err: any) {
      showMsg(err.message || 'Failed to update return date.', 'error');
    }
  };

  const togglePaymentStatus = async () => {
    if (!selectedBill) {
      alert(tr('select_bill_first'));
      return;
    }
    try {
      const newPaid = !selectedBill.paid;
      await db.setPaymentStatus(selectedBill.id, newPaid);
      showMsg('Payment status updated successfully.', 'success');
      fetchBills();
    } catch (err: any) {
      showMsg(err.message || 'Failed to update payment status.', 'error');
    }
  };

  const handleUndoReturn = async () => {
    if (!selectedBill) {
      alert(tr('select_bill_first'));
      return;
    }
    const confirmUndo = window.confirm(tr('move_back_active'));
    if (!confirmUndo) return;

    try {
      await db.undoReturnRental(selectedBill.id);
      showMsg(tr('rental_marked_not_returned'), 'success');
      fetchBills();
    } catch (err: any) {
      showMsg(err.message || 'Failed to undo return.', 'error');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return dateStr.split('-').reverse().join('/');
  };

  if (loading) {
    return <div className="page-container"><div>Loading...</div></div>;
  }

  // Determine rate per day string
  const getRateStr = (bill: GroupedRental) => {
    // If it contains multiple tools (comma separated tool_name)
    if (bill.tool_name.includes(',')) {
      return '-';
    }
    // Calculate single tool rate
    const days = bill.days || 1;
    const qty = bill.quantity || 1;
    const rate = Number(bill.amount) / (days * qty);
    return rate.toFixed(2);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">{tr('bills')}</h1>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-warning'}`}>
          {message.text}
        </div>
      )}

      {/* Search Input */}
      <input
        type="text"
        className="search-input"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder={tr('bills_search')}
        style={{ width: '100%' }}
      />

      {/* Table listing bills */}
      <div className="table-container" style={{ flex: 1 }}>
        <table>
          <thead>
            <tr>
              <th>Bill No</th>
              <th>{tr('customer_name')}</th>
              <th>{tr('phone_number')}</th>
              <th>{tr('tool_name')}</th>
              <th>{tr('quantity')}</th>
              <th>{tr('rent_date')}</th>
              <th>{tr('return_date')}</th>
              <th>{tr('days')}</th>
              <th>{tr('rate_per_day')}</th>
              <th>{tr('amount')}</th>
              <th>{tr('payment_status')}</th>
            </tr>
          </thead>
          <tbody>
            {bills.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No bills found.
                </td>
              </tr>
            ) : (
              bills.map((b) => (
                <tr
                  key={b.id}
                  className={selectedBill?.id === b.id ? 'selected' : ''}
                  onClick={() => handleRowClick(b)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{b.id.substring(0, 8).toUpperCase()}</td>
                  <td>{b.customer_name}</td>
                  <td>{b.phone}</td>
                  <td>{b.tool_name}</td>
                  <td>{b.quantity}</td>
                  <td>{formatDate(b.rent_date)}</td>
                  <td>{formatDate(b.actual_return_date || b.return_date)}</td>
                  <td>{b.days || 0}</td>
                  <td>{getRateStr(b)}</td>
                  <td>{Number(b.amount).toFixed(2)}</td>
                  <td>{b.paid ? tr('paid') : tr('not_paid')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handlePrint} disabled={!selectedBill}>
          <Printer size={16} />
          {tr('print_preview')}
        </button>
        <button className="btn" onClick={handlePrint} disabled={!selectedBill}>
          <FileText size={16} />
          {tr('save_pdf')}
        </button>
        <button className="btn" onClick={handleOpenEditDate} disabled={!selectedBill}>
          <Calendar size={16} />
          {tr('update_return_date')}
        </button>
        <button className="btn" onClick={togglePaymentStatus} disabled={!selectedBill}>
          <HelpCircle size={16} />
          {selectedBill?.paid ? tr('mark_as_not_paid') : tr('mark_as_paid')}
        </button>
        <button className="btn btn-danger" onClick={handleUndoReturn} disabled={!selectedBill}>
          <RotateCcw size={16} />
          {tr('mark_not_returned')}
        </button>
      </div>

      {/* Date Update Modal */}
      {showDateModal && selectedBill && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title">{tr('update_return_date')}</div>

            <div className="form-group">
              <label>{tr('actual_return_date')}</label>
              <input
                type="date"
                value={newReturnDate}
                onChange={(e) => setNewReturnDate(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowDateModal(false)}>{tr('close')}</button>
              <button className="btn btn-primary" onClick={submitEditDate}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
