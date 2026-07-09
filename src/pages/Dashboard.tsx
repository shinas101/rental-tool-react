import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../utils/db';
import type { Tool, Rental } from '../utils/db';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { tr } = useLanguage();
  const [stats, setStats] = useState({ total_tools: 0, available_tools: 0, active_rentals: 0 });
  const [showToolsTable, setShowToolsTable] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [rentalsHistory, setRentalsHistory] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      const data = await db.dashboardStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard stats.');
    }
  };

  useEffect(() => {
    fetchStats().finally(() => setLoading(false));
  }, []);

  const handleTotalToolsClick = async () => {
    setShowToolsTable(true);
    try {
      const allTools = await db.allTools();
      setTools(allTools);
      if (allTools.length > 0) {
        handleToolSelect(allTools[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tools.');
    }
  };

  const handleToolSelect = async (tool: Tool) => {
    setSelectedTool(tool);
    try {
      const history = await db.toolRentals(tool.name);
      setRentalsHistory(history);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tool history.');
    }
  };

  if (loading) {
    return <div className="page-container"><div>Loading...</div></div>;
  }

  return (
    <div className="page-container">
      <h1 className="page-title">{tr('dashboard')}</h1>

      {error && (
        <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card" onClick={handleTotalToolsClick}>
          <div className="metric-label">{tr('total_tools')}</div>
          <div className="metric-value">{stats.total_tools}</div>
        </div>
        <div className="metric-card" onClick={() => onNavigate('tools')}>
          <div className="metric-label">{tr('available_tools')}</div>
          <div className="metric-value">{stats.available_tools}</div>
        </div>
        <div className="metric-card" onClick={() => onNavigate('active_rentals')}>
          <div className="metric-label">{tr('active_rentals_count')}</div>
          <div className="metric-value">{stats.active_rentals}</div>
        </div>
      </div>

      {/* Tools List section (Visible after clicking Total Tools) */}
      {showToolsTable && (
        <>
          <h2 className="page-title" style={{ fontSize: '1.4rem', marginTop: '16px' }}>{tr('all_tools')}</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>{tr('tool_name')}</th>
                  <th>{tr('available_qty')} / {tr('total_tools')}</th>
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
                      onClick={() => handleToolSelect(t)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{t.name}</td>
                      <td>{t.available_qty} / {t.total_qty ?? t.available_qty}</td>
                      <td>{t.rate_per_day.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {selectedTool && (
            <>
              <div style={{ margin: '12px 0 4px 0', fontSize: '0.95rem' }}>
                <span className="text-muted" style={{ color: 'var(--text-muted)' }}>
                  {selectedTool.name} - {tr('available_qty')}: {selectedTool.available_qty} / {selectedTool.total_qty ?? selectedTool.available_qty}
                </span>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>{tr('customer_name')}</th>
                      <th>{tr('phone_number')}</th>
                      <th>{tr('quantity')}</th>
                      <th>{tr('rent_date')}</th>
                      <th>{tr('return_date')}</th>
                      <th>{tr('status')}</th>
                      <th>{tr('amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rentalsHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center' }}>
                          {tr('select_tool_hint')}
                        </td>
                      </tr>
                    ) : (
                      rentalsHistory.map((rh) => {
                        const status = rh.returned ? tr('status_returned') : tr('status_active');
                        const amount = rh.amount !== null ? rh.amount.toFixed(2) : '-';
                        const returnDateVal = rh.actual_return_date || rh.return_date;
                        return (
                          <tr key={rh.id}>
                            <td>{rh.customer_name}</td>
                            <td>{rh.phone}</td>
                            <td>{rh.quantity}</td>
                            <td>{rh.rent_date.split('-').reverse().join('/')}</td>
                            <td>{returnDateVal.split('-').reverse().join('/')}</td>
                            <td>{status}</td>
                            <td>{amount}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
