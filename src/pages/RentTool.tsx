import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../utils/db';
import type { Tool } from '../utils/db';
import { Trash2, ArrowDown, RotateCcw } from 'lucide-react';

interface CartItem {
  name: string;
  qty: number;
  rate: number;
}

export const RentTool: React.FC = () => {
  const { tr } = useLanguage();
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  
  const [activeTools, setActiveTools] = useState<Tool[]>([]);
  const [selectedToolName, setSelectedToolName] = useState('');
  const [qty, setQty] = useState(1);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [rentDate, setRentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchActiveTools = async () => {
    try {
      const data = await db.activeTools();
      setActiveTools(data);
      if (data.length > 0) {
        setSelectedToolName(data[0].name);
      } else {
        setSelectedToolName('');
      }
    } catch (err: any) {
      showMsg(err.message || 'Failed to fetch active tools.', 'error');
    }
  };

  useEffect(() => {
    fetchActiveTools();
  }, []);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage(null);
    }, 5000);
  };

  const handleAddToCart = () => {
    if (!selectedToolName) {
      showMsg(tr('add_available_tool_first'), 'error');
      return;
    }

    const toolInfo = activeTools.find(t => t.name === selectedToolName);
    if (!toolInfo) return;

    if (qty <= 0) {
      showMsg('Quantity must be greater than zero.', 'error');
      return;
    }

    // Check existing quantity in cart
    const existing = cart.find(item => item.name === selectedToolName);
    const existingQty = existing ? existing.qty : 0;
    const totalRequested = existingQty + qty;

    if (toolInfo.available_qty < totalRequested) {
      showMsg(`Only ${toolInfo.available_qty} units of ${selectedToolName} are available.`, 'error');
      return;
    }

    if (existing) {
      setCart(cart.map(item => 
        item.name === selectedToolName 
          ? { ...item, qty: item.qty + qty }
          : item
      ));
    } else {
      setCart([...cart, {
        name: selectedToolName,
        qty: qty,
        rate: toolInfo.rate_per_day
      }]);
    }

    setQty(1);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, idx) => idx !== index));
  };

  const clearForm = () => {
    setCustomer('');
    setPhone('');
    setCart([]);
    setQty(1);
    setRentDate(new Date().toISOString().split('T')[0]);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setReturnDate(tomorrow.toISOString().split('T')[0]);
  };

  const validate = () => {
    if (!customer.trim()) {
      showMsg(tr('enter_customer_name'), 'error');
      return false;
    }
    if (!phone.trim()) {
      showMsg(tr('enter_phone_number'), 'error');
      return false;
    }
    if (cart.length === 0) {
      showMsg(tr('add_tool_first'), 'error');
      return false;
    }
    if (new Date(returnDate) < new Date(rentDate)) {
      showMsg(tr('return_before_rent'), 'error');
      return false;
    }
    return true;
  };

  const handleRent = async () => {
    if (!validate()) return;

    try {
      const items = cart.map(item => ({ name: item.name, qty: item.qty }));
      await db.rentTools(customer, phone, items, rentDate, returnDate);
      showMsg(tr('tool_rented_successfully'), 'success');
      clearForm();
      fetchActiveTools();
    } catch (err: any) {
      showMsg(err.message || 'Rental failed.', 'error');
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">{tr('rent_tool')}</h1>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-warning'}`}>
          {message.text}
        </div>
      )}

      <div className="rent-split-layout">
        {/* Left Column: Rental Form */}
        <div className="rent-split-left" style={{ background: 'var(--bg-card)', padding: '20px', border: 'var(--border-card)', borderRadius: 'var(--border-radius-card, var(--border-radius))' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Rental Details</h2>

          <div className="form-group">
            <label>{tr('customer_name')}</label>
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder={tr('customer_name')}
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-group">
            <label>{tr('phone_number')}</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={tr('phone_number')}
              style={{ width: '100%' }}
            />
          </div>

          {/* Tool Select & Add Row */}
          <div className="form-group">
            <label>{tr('tool')}</label>
            <div className="tool-add-row">
              <select
                value={selectedToolName}
                onChange={(e) => setSelectedToolName(e.target.value)}
              >
                {activeTools.length === 0 ? (
                  <option value="">No active tools available</option>
                ) : (
                  activeTools.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} - Available: {t.available_qty} - Rate: ₹{t.rate_per_day.toFixed(2)}/day
                    </option>
                  ))
                )}
              </select>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
              <button type="button" className="btn" onClick={handleAddToCart}>
                <ArrowDown size={16} />
                {tr('add_to_list')}
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{tr('rent_date')}</label>
              <input
                type="date"
                value={rentDate}
                onChange={(e) => setRentDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>{tr('expected_return_date')}</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Tools Selection Cart */}
        <div className="rent-split-right" style={{ background: 'var(--bg-card)', padding: '20px', border: 'var(--border-card)', borderRadius: 'var(--border-radius-card, var(--border-radius))' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Tools Selection Cart</h2>
          
          <div className="cart-table-container" style={{ width: '100%' }}>
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
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      {tr('cart_empty')}
                    </td>
                  </tr>
                ) : (
                  cart.map((item, index) => (
                    <tr key={index}>
                      <td>{item.name}</td>
                      <td>{item.qty}</td>
                      <td>{item.rate.toFixed(2)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', minHeight: 'auto' }}
                          onClick={() => handleRemoveFromCart(index)}
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

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', width: '100%', paddingTop: '10px' }}>
            <button type="button" className="btn btn-primary" onClick={handleRent} style={{ flex: 1 }}>
              {tr('rent_tool')}
            </button>
            <button type="button" className="btn" onClick={clearForm} style={{ flex: 1 }}>
              <RotateCcw size={16} />
              {tr('clear')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
