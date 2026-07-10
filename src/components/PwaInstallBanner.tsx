import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaInstallBanner: React.FC = () => {
  const { tr } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // 1. Check if application is already running in standalone mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      return;
    }

    // 2. Check if user already dismissed the prompt
    const isDismissed = localStorage.getItem('pwa_prompt_dismissed') === 'true';
    if (isDismissed) {
      return;
    }

    // 3. Check for iOS device
    const userAgent = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    setIsIos(ios);

    if (ios) {
      // For iOS, check if it's Safari (since chrome on ios doesn't support PWA install)
      const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
      if (isSafari) {
        // Show iOS install guidance after 2 seconds
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 2000);
        return () => clearTimeout(timer);
      }
    } else {
      // 4. For Android/Chrome/Windows: listen to 'beforeinstallprompt'
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setIsVisible(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Show manual fallback prompt after 3 seconds for first-time visitors
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        clearTimeout(timer);
      };
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    // Persist user dismissal so we don't prompt on every page reload
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install choice: ${outcome}`);
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!isVisible) return null;

  return (
    <div className="pwa-install-banner">
      <div className="pwa-banner-content">
        <button className="pwa-banner-close" onClick={handleDismiss} aria-label="Dismiss">
          <X size={18} />
        </button>
        <div className="pwa-banner-header">
          <img src="/icon-192.png" alt="MINNAS RENT SHOP" className="pwa-banner-logo" />
          <div className="pwa-banner-text-group">
            <h3 className="pwa-banner-title">{tr('pwa_install_title')}</h3>
            <p className="pwa-banner-desc">{tr('pwa_install_desc')}</p>
          </div>
        </div>

        {isIos ? (
          <div className="pwa-banner-ios-instructions">
            <div className="ios-instructions-text">
              {tr('pwa_ios_instructions')}
            </div>
            <button className="btn btn-primary pwa-banner-btn-primary" onClick={handleDismiss}>
              {tr('close')}
            </button>
          </div>
        ) : deferredPrompt ? (
          <div className="pwa-banner-actions">
            <button className="btn pwa-banner-btn-secondary" onClick={handleDismiss}>
              {tr('pwa_dismiss_btn')}
            </button>
            <button className="btn btn-primary pwa-banner-btn-primary" onClick={handleInstall}>
              <Download size={16} style={{ marginRight: '6px' }} />
              {tr('pwa_install_btn')}
            </button>
          </div>
        ) : (
          <div className="pwa-banner-ios-instructions">
            <div className="ios-instructions-text">
              {tr('pwa_manual_instructions')}
            </div>
            <button className="btn btn-primary pwa-banner-btn-primary" onClick={handleDismiss}>
              {tr('close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
