import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../utils/db';
import type { Tool } from '../utils/db';
import { Plus, Check, Trash2, RotateCcw } from 'lucide-react';

export const Tools: React.FC = () => {
  const { tr } = useLanguage();
  const [tools, setTools] = useState<Tool[]>([]);
  const [name, setName] = useState('');
  const [qty, setQty] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTools = async () => {
    try {
      const data = await db.allTools();
      setTools(data);
    } catch (err: any) {
      showMsg(err.message || 'Failed to fetch tools.', 'error');
    }
  };

  useEffect(() => {
    fetchTools().finally(() => setLoading(false));
  }, []);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage(null);
    }, 5000);
  };

  const handleRowClick = (tool: Tool) => {
    setSelectedTool(tool);
    setName(tool.name);
    setQty(tool.available_qty);
    setRate(tool.rate_per_day);
  };

  const clearForm = () => {
    setSelectedTool(null);
    setName('');
    setQty(0);
    setRate(0);
  };

  const validate = () => {
    if (!name.trim()) {
      showMsg(tr('enter_tool_name'), 'error');
      return false;
    }
    return true;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await db.addTool(name, qty, rate);
      showMsg(tr('tool_rented_successfully').replace(tr('tool_rented_successfully'), 'Tool added successfully'), 'success');
      clearForm();
      fetchTools();
    } catch (err: any) {
      if (err.message.includes('exists')) {
        showMsg(tr('tool_exists'), 'error');
      } else {
        showMsg(err.message, 'error');
      }
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool) {
      showMsg(tr('select_tool_edit'), 'error');
      return;
    }
    if (!validate()) return;

    try {
      await db.updateTool(selectedTool.id, name, qty, rate);
      showMsg('Tool updated successfully.', 'success');
      clearForm();
      fetchTools();
    } catch (err: any) {
      if (err.message.includes('exists')) {
        showMsg(tr('tool_exists'), 'error');
      } else {
        showMsg(err.message, 'error');
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedTool) {
      showMsg(tr('select_tool_delete'), 'error');
      return;
    }

    const confirmDelete = window.confirm(tr('delete_selected_tool'));
    if (!confirmDelete) return;

    try {
      await db.deleteTool(selectedTool.id);
      showMsg('Tool deleted successfully.', 'success');
      clearForm();
      fetchTools();
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  if (loading) {
    return <div className="page-container"><div>Loading...</div></div>;
  }

  return (
    <div className="page-container">
      <h1 className="page-title">{tr('tools')}</h1>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-warning'}`}>
          {message.text}
        </div>
      )}

      {/* CRUD Form */}
      <form onSubmit={(e) => e.preventDefault()} className="form-layout" style={{ background: 'var(--bg-card)', padding: '20px', border: 'var(--border-card)', borderRadius: 'var(--border-radius-card, var(--border-radius))' }}>
        <div className="form-group">
          <label>{tr('tool_name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr('tool_name')}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>{tr('available_qty')}</label>
            <input
              type="number"
              min="0"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>{tr('rate_per_day')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Form Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
          <button type="button" className="btn btn-primary" onClick={handleAdd}>
            <Plus size={16} />
            {tr('add_tool')}
          </button>
          <button type="button" className="btn" onClick={handleUpdate} disabled={!selectedTool}>
            <Check size={16} />
            {tr('edit_tool')}
          </button>
          <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={!selectedTool}>
            <Trash2 size={16} />
            {tr('delete_tool')}
          </button>
          <button type="button" className="btn" onClick={clearForm}>
            <RotateCcw size={16} />
            {tr('clear')}
          </button>
        </div>
      </form>

      {/* Tools list table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{tr('tool_name')}</th>
              <th>{tr('available_qty')}</th>
              <th>{tr('rate_per_day')}</th>
            </tr>
          </thead>
          <tbody>
            {tools.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center' }}>No tools added yet.</td>
              </tr>
            ) : (
              tools.map((t) => (
                <tr
                  key={t.id}
                  className={selectedTool?.id === t.id ? 'selected' : ''}
                  onClick={() => handleRowClick(t)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{t.name}</td>
                  <td>{t.available_qty}</td>
                  <td>{t.rate_per_day.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
