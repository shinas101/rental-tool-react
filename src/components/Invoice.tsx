import React from 'react';

export interface InvoiceItem {
  tool_name: string;
  quantity: number;
  rate_per_day: number;
  days: number;
  amount: number;
}

export interface InvoiceData {
  bill_no: string;
  customer_name: string;
  phone: string;
  rent_date: string;
  return_date: string;
  days: number;
  items: InvoiceItem[];
  amount: number;
}

interface InvoiceProps {
  data: InvoiceData | null;
}

export const Invoice: React.FC<InvoiceProps> = ({ data }) => {
  if (!data) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const isMultiple = data.items.length > 1;
  const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div style={{
      fontFamily: '"Segoe UI", Arial, sans-serif',
      fontSize: '11.5pt',
      color: '#101828',
      background: '#ffffff',
      border: '1px solid #d9e0ea',
      borderRadius: '14px',
      padding: '28px',
      width: '100%',
      maxWidth: '680px',
      margin: '0 auto',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '16px',
        marginBottom: '18px'
      }}>
        <div style={{ textAlign: 'left' }}>
          <h1 style={{ fontSize: '21pt', fontWeight: 800, margin: 0, letterSpacing: '0.2px' }}>
            MINNAS RENT SHOP
          </h1>
          <div style={{ marginTop: '4px', color: '#101828', fontSize: '10.5pt', fontWeight: 600 }}>
            Vakkaloor
          </div>
          <div style={{ marginTop: '2px', color: '#667085', fontSize: '10pt' }}>
            Phone: 9846206878, 9605374802
          </div>
        </div>
        <div style={{ textAlign: 'right', color: '#475467', fontSize: '10pt', lineHeight: 1.45 }}>
          Bill No<br />
          <strong style={{ color: '#101828', fontSize: '11pt' }}>{data.bill_no}</strong>
        </div>
      </div>

      {/* Titlebar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 16px',
        background: '#f2f6fc',
        border: '1px solid #dbe3ef',
        borderRadius: '10px',
        margin: '18px 0',
        boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: '#667085', fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Invoice
          </div>
          <div style={{ fontSize: '14pt', fontWeight: 700, color: '#1d2939' }}>
            {data.customer_name}
          </div>
        </div>
        <div style={{ textAlign: 'right', color: '#475467', fontSize: '10pt', lineHeight: 1.45 }}>
          {isMultiple ? (
            <>
              Multiple Tools<br />
              Total Qty {totalQty}
            </>
          ) : (
            <>
              {data.items[0]?.tool_name || ''}<br />
              Qty {data.items[0]?.quantity || 0}
            </>
          )}
        </div>
      </div>

      {/* Meta Info */}
      <div style={{ marginBottom: '16px', color: '#475467', lineHeight: 1.6, textAlign: 'left' }}>
        <strong>Phone:</strong> {data.phone}<br />
        <strong>Rent Date:</strong> {formatDate(data.rent_date)}<br />
        <strong>Return Date:</strong> {formatDate(data.return_date)}
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #d9e0ea', fontWeight: 'bold', color: '#475467' }}>
            <th style={{ textAlign: 'left', paddingBottom: '8px', background: 'transparent', color: '#475467' }}>
              Tool Name
            </th>
            <th style={{ textAlign: 'right', paddingBottom: '8px', background: 'transparent', color: '#475467', width: '10%' }}>
              Qty
            </th>
            <th style={{ textAlign: 'right', paddingBottom: '8px', background: 'transparent', color: '#475467', width: '18%' }}>
              Rate/Day
            </th>
            <th style={{ textAlign: 'right', paddingBottom: '8px', background: 'transparent', color: '#475467', width: '12%' }}>
              Days
            </th>
            <th style={{ textAlign: 'right', paddingBottom: '8px', background: 'transparent', color: '#475467', width: '18%' }}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={idx} style={{ background: 'transparent' }}>
              <td style={{ textAlign: 'left', color: '#101828', padding: '10px 0', borderBottom: '1px solid #eaecf0' }}>
                {item.tool_name}
              </td>
              <td style={{ textAlign: 'right', color: '#101828', padding: '10px 0', borderBottom: '1px solid #eaecf0' }}>
                {item.quantity}
              </td>
              <td style={{ textAlign: 'right', color: '#101828', padding: '10px 0', borderBottom: '1px solid #eaecf0' }}>
                ₹{item.rate_per_day.toFixed(2)}
              </td>
              <td style={{ textAlign: 'right', color: '#101828', padding: '10px 0', borderBottom: '1px solid #eaecf0' }}>
                {item.days}
              </td>
              <td style={{ textAlign: 'right', fontWeight: 600, color: '#101828', padding: '10px 0', borderBottom: '1px solid #eaecf0' }}>
                ₹{item.amount.toFixed(2)}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ paddingTop: '16px', fontSize: '12pt', fontWeight: 800, color: '#0f172a', borderTop: '2px solid #d9e0ea', textAlign: 'left', background: 'transparent' }}>
              Total Amount
            </td>
            <td style={{ paddingTop: '16px', textAlign: 'right', fontSize: '12pt', fontWeight: 800, color: '#0f172a', borderTop: '2px solid #d9e0ea', background: 'transparent' }}>
              ₹{data.amount.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ marginTop: '24px', textAlign: 'center', color: '#475467', fontSize: '10pt' }}>
        Thank you for choosing MINNAS RENT SHOP.
      </div>
    </div>
  );
};
