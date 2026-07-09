import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../utils/db';
import type { CreditCustomer, GroupedRental } from '../utils/db';
import { Check, Printer, FileText, MessageCircle } from 'lucide-react';

interface CreditsProps {
  onPrint: (data: any) => void;
}

export const Credits: React.FC<CreditsProps> = ({ onPrint }) => {
  const { tr } = useLanguage();
  const [credits, setCredits] = useState<CreditCustomer[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<CreditCustomer | null>(null);

  const [unpaidBills, setUnpaidBills] = useState<GroupedRental[]>([]);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCredits = async () => {
    try {
      const data = await db.getCreditCustomers(searchText);
      setCredits(data);

      if (selectedCredit) {
        const stillExists = data.find(c => c.customer_name === selectedCredit.customer_name && c.phone === selectedCredit.phone);
        if (stillExists) {
          setSelectedCredit(stillExists);
          fetchUnpaidBills(stillExists.customer_name, stillExists.phone);
        } else {
          setSelectedCredit(null);
          setUnpaidBills([]);
        }
      } else if (data.length > 0) {
        setSelectedCredit(data[0]);
        fetchUnpaidBills(data[0].customer_name, data[0].phone);
      }
    } catch (err: any) {
      showMsg(err.message || 'Failed to fetch credits.', 'error');
    }
  };

  const fetchUnpaidBills = async (name: string, phone: string) => {
    try {
      const data = await db.getCustomerUnpaidRentals(name, phone);
      setUnpaidBills(data);
    } catch (err: any) {
      showMsg('Failed to load customer unpaid bills.', 'error');
    }
  };

  useEffect(() => {
    fetchCredits().finally(() => setLoading(false));
  }, [searchText]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage(null);
    }, 5000);
  };

  const handleRowClick = (credit: CreditCustomer) => {
    setSelectedCredit(credit);
    fetchUnpaidBills(credit.customer_name, credit.phone);
  };

  const handlePayAll = async () => {
    if (!selectedCredit) {
      alert(tr('select_rental_first'));
      return;
    }

    const confirmPay = window.confirm(tr('mark_customer_paid_confirm', selectedCredit.customer_name));
    if (!confirmPay) return;

    try {
      await db.markCustomerAsPaid(selectedCredit.customer_name, selectedCredit.phone);
      showMsg(tr('rental_returned'), 'success');
      fetchCredits();
    } catch (err: any) {
      showMsg(err.message || 'Failed to settle credits.', 'error');
    }
  };

  const handlePrintCombined = async () => {
    if (!selectedCredit) {
      alert(tr('select_rental_first'));
      return;
    }
    try {
      const data = await db.getCombinedInvoiceData(selectedCredit.customer_name, selectedCredit.phone);
      if (data) {
        onPrint(data);
      }
    } catch (err: any) {
      showMsg('Failed to load combined invoice data.', 'error');
    }
  };

  const handleWhatsAppShare = async () => {
    if (!selectedCredit) {
      alert(tr('select_rental_first'));
      return;
    }
    try {
      const unpaid = await db.getCustomerUnpaidRentals(selectedCredit.customer_name, selectedCredit.phone);
      
      const formatDateStr = (dateStr: string | null) => {
        if (!dateStr) return '';
        return dateStr.split('-').reverse().join('/');
      };

      let msg = `*${tr('app_name')}*\n`;
      msg += `_${tr('shop_location')}_\n`;
      msg += `_${tr('shop_phone')}_\n\n`;
      msg += `*${tr('credit_tracking')} Summary*\n\n`;
      msg += `*${tr('customer_name')}:* ${selectedCredit.customer_name}\n`;
      msg += `*${tr('phone_number')}:* ${selectedCredit.phone}\n`;
      msg += `*${tr('total_credit')}:* ₹${selectedCredit.total_credit.toFixed(2)}\n\n`;
      
      msg += `*Unpaid Bills Detail:*\n`;
      unpaid.forEach((bill) => {
        const billNo = bill.id.substring(0, 8).toUpperCase();
        const returnDateStr = formatDateStr(bill.actual_return_date || bill.return_date);
        msg += `- Bill No: ${billNo}\n`;
        msg += `  Date: ${returnDateStr}\n`;
        msg += `  Tools: ${bill.tool_name}\n`;
        msg += `  Amount: ₹${bill.amount.toFixed(2)}\n`;
      });
      
      msg += `\nThank you for choosing ${tr('app_name')}. Please settle outstanding dues at your earliest convenience.`;
      
      let cleanedPhone = selectedCredit.phone.replace(/\D/g, '');
      if (cleanedPhone.length === 10) {
        cleanedPhone = '91' + cleanedPhone;
      }
      
      const link = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(msg)}`;
      window.open(link, '_blank');
    } catch (err: any) {
      showMsg('Failed to generate WhatsApp message.', 'error');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return dateStr.split('-').reverse().join('/');
  };

  if (loading) {
    return <div className="page-container"><div>Loading...</div></div>;
  }

  return (
    <div className="page-container">
      <h1 className="page-title">{tr('credit_tracking')}</h1>

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
            placeholder={tr('credits_search')}
            style={{ width: '100%' }}
          />

          <div className="table-container" style={{ flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th>{tr('customer_name')}</th>
                  <th>{tr('phone_number')}</th>
                  <th>{tr('bill_count')}</th>
                  <th>{tr('total_credit')}</th>
                  <th>{tr('tools_on_credit')}</th>
                </tr>
              </thead>
              <tbody>
                {credits.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No credit customers found.
                    </td>
                  </tr>
                ) : (
                  credits.map((c, idx) => (
                    <tr
                      key={idx}
                      className={selectedCredit?.customer_name === c.customer_name && selectedCredit?.phone === c.phone ? 'selected' : ''}
                      onClick={() => handleRowClick(c)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{c.customer_name}</td>
                      <td>{c.phone}</td>
                      <td>{c.bill_count}</td>
                      <td>{c.total_credit.toFixed(2)}</td>
                      <td>{c.tools}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handlePayAll} disabled={!selectedCredit}>
              <Check size={16} />
              {tr('mark_customer_paid')}
            </button>
            <button className="btn" onClick={handlePrintCombined} disabled={!selectedCredit}>
              <Printer size={16} />
              {tr('combined_invoice')}
            </button>
            <button className="btn" onClick={handlePrintCombined} disabled={!selectedCredit}>
              <FileText size={16} />
              {tr('save_pdf')}
            </button>
            <button className="btn btn-whatsapp" onClick={handleWhatsAppShare} disabled={!selectedCredit}>
              <MessageCircle size={16} />
              {tr('share_whatsapp')}
            </button>
          </div>
        </div>

        {/* Right Column (Details sidebar) */}
        <div className="split-right">
          <div className="details-title">{tr('rental_details')}</div>

          {!selectedCredit ? (
            <div className="placeholder_label" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)' }}>
              {tr('select_rental_details')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <strong>{tr('customer_name')}:</strong> {selectedCredit.customer_name}
              </div>
              <div>
                <strong>{tr('phone_number')}:</strong> {selectedCredit.phone}
              </div>
              <div style={{ color: 'var(--bg-primary)' }}>
                <strong>{tr('total_credit')}:</strong> ₹{selectedCredit.total_credit.toFixed(2)}
              </div>

              <div style={{ fontWeight: '700', marginTop: '8px' }}>{tr('bills')}</div>
              <div className="table-container" style={{ maxHeight: '240px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Bill No</th>
                      <th>{tr('return_date')}</th>
                      <th>{tr('tools_taken')}</th>
                      <th>{tr('amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidBills.map((bill, idx) => (
                      <tr key={idx}>
                        <td>{bill.id.substring(0, 8).toUpperCase()}</td>
                        <td>{formatDate(bill.actual_return_date || bill.return_date)}</td>
                        <td>{bill.tool_name}</td>
                        <td>{bill.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
