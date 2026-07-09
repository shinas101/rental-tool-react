import { useState } from 'react';
import { useLanguage } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';
import { Dashboard } from './pages/Dashboard';
import { Tools } from './pages/Tools';
import { RentTool } from './pages/RentTool';
import { ActiveRentals } from './pages/ActiveRentals';
import { Bills } from './pages/Bills';
import { Credits } from './pages/Credits';
import { Invoice } from './components/Invoice';
import type { InvoiceData } from './components/Invoice';
import { LayoutDashboard, Wrench, CalendarPlus, FileClock, Receipt, Coins, Printer, X } from 'lucide-react';
import { PwaInstallBanner } from './components/PwaInstallBanner';

export default function App() {
  const { tr, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceData | null>(null);

  const handlePrintTrigger = (data: InvoiceData) => {
    setPreviewInvoice(data);
  };

  const executePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="app-container">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-title-section">
            <div className="topbar-title">{tr('app_name')}</div>
            <div className="shop-info-group">
              <span className="shop-location-text">{tr('shop_location')}</span>
              <span className="shop-phone-text">{tr('shop_phone')}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="topbar-group">
              <span className="topbar-label">{tr('language')}:</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'ml')}
                style={{ padding: '4px 8px', fontSize: '0.85rem' }}
              >
                <option value="en">{tr('english')}</option>
                <option value="ml">{tr('malayalam')}</option>
              </select>
            </div>
            <div className="topbar-group">
              <span className="topbar-label">{tr('theme')}:</span>
              <select
                value={theme}
                onChange={(e) => {
                  if (e.target.value !== theme) toggleTheme();
                }}
                style={{ padding: '4px 8px', fontSize: '0.85rem' }}
              >
                <option value="dark">{tr('dark')}</option>
                <option value="light">{tr('light')}</option>
              </select>
            </div>
          </div>
        </header>

        {/* Main Area */}
        <div className="main-content">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="brand-section">
              <div className="brand-title">{tr('app_name')}</div>
            </div>

            <button
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={18} />
              {tr('dashboard')}
            </button>
            <button
              className={`nav-item ${activeTab === 'tools' ? 'active' : ''}`}
              onClick={() => setActiveTab('tools')}
            >
              <Wrench size={18} />
              {tr('tools')}
            </button>
            <button
              className={`nav-item ${activeTab === 'rent_tool' ? 'active' : ''}`}
              onClick={() => setActiveTab('rent_tool')}
            >
              <CalendarPlus size={18} />
              {tr('rent_tool')}
            </button>
            <button
              className={`nav-item ${activeTab === 'active_rentals' ? 'active' : ''}`}
              onClick={() => setActiveTab('active_rentals')}
            >
              <FileClock size={18} />
              {tr('active_rentals')}
            </button>
            <button
              className={`nav-item ${activeTab === 'bills' ? 'active' : ''}`}
              onClick={() => setActiveTab('bills')}
            >
              <Receipt size={18} />
              {tr('bills')}
            </button>
            <button
              className={`nav-item ${activeTab === 'credits' ? 'active' : ''}`}
              onClick={() => setActiveTab('credits')}
            >
              <Coins size={18} />
              {tr('credits')}
            </button>
          </aside>

          {/* Dynamic Pages */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
            {activeTab === 'tools' && <Tools />}
            {activeTab === 'rent_tool' && <RentTool />}
            {activeTab === 'active_rentals' && <ActiveRentals onPrint={handlePrintTrigger} />}
            {activeTab === 'bills' && <Bills onPrint={handlePrintTrigger} />}
            {activeTab === 'credits' && <Credits onPrint={handlePrintTrigger} />}
          </main>
        </div>

        {/* Invoice Preview Dialog (Modal) */}
        {previewInvoice && (
          <div className="modal-overlay" style={{ overflowY: 'auto', padding: '40px 0' }}>
            <div className="modal-content" style={{ maxWidth: '720px', width: '95%', background: '#f7f8fb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111' }}>{tr('print_preview')}</div>
                <button
                  className="btn btn-icon"
                  style={{ background: 'transparent', border: 'none', color: '#666' }}
                  onClick={() => setPreviewInvoice(null)}
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* Embedded Invoice component */}
              <div style={{ overflowX: 'auto' }}>
                <Invoice data={previewInvoice} />
              </div>

              <div className="modal-actions" style={{ marginTop: '10px' }}>
                <button className="btn" onClick={() => setPreviewInvoice(null)} style={{ background: '#fff', color: '#111' }}>
                  {tr('close')}
                </button>
                <button className="btn btn-primary" onClick={executePrint}>
                  <Printer size={16} />
                  {tr('print_now')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Navigation */}
        <nav className="mobile-nav">
          <button
            className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>{tr('dashboard')}</span>
          </button>
          <button
            className={`mobile-nav-item ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            <Wrench size={18} />
            <span>{tr('tools')}</span>
          </button>
          <button
            className={`mobile-nav-item ${activeTab === 'rent_tool' ? 'active' : ''}`}
            onClick={() => setActiveTab('rent_tool')}
          >
            <CalendarPlus size={18} />
            <span>{tr('rent_tool').includes('വാടക') ? 'വാടക' : 'Rent'}</span>
          </button>
          <button
            className={`mobile-nav-item ${activeTab === 'active_rentals' ? 'active' : ''}`}
            onClick={() => setActiveTab('active_rentals')}
          >
            <FileClock size={18} />
            <span>{tr('active_rentals').includes('സജീവം') ? 'സജീവം' : 'Active'}</span>
          </button>
          <button
            className={`mobile-nav-item ${activeTab === 'bills' ? 'active' : ''}`}
            onClick={() => setActiveTab('bills')}
          >
            <Receipt size={18} />
            <span>{tr('bills')}</span>
          </button>
          <button
            className={`mobile-nav-item ${activeTab === 'credits' ? 'active' : ''}`}
            onClick={() => setActiveTab('credits')}
          >
            <Coins size={18} />
            <span>{tr('credits').includes('കടങ്ങൾ') ? 'കടം' : 'Credits'}</span>
          </button>
        </nav>
      </div>

      {/* Hidden printable invoice container */}
      <div id="print-area">
        {previewInvoice && <Invoice data={previewInvoice} />}
      </div>
      <PwaInstallBanner />
    </>
  );
}
