import React, { useEffect, useState } from 'react';
import VerifiedBadge from './VerifiedBadge';

function NotificationPopup({ notification, onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // ⏱️ Auto dismiss after 60,000ms (1 minute)
    const timer = setTimeout(() => {
      handleClose();
    }, 60000);

    return () => clearTimeout(timer);
  }, [notification]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300); // Wait for fade-out animation
  };

  if (!notification || !visible) return null;

  const senderObj = typeof notification.sender === 'object' ? notification.sender : null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      background: '#ffffff',
      boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
      borderRadius: '16px',
      padding: '1rem 1.2rem',
      maxWidth: '340px',
      width: '90%',
      borderLeft: '5px solid #5b72f2',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      animation: 'slideIn 0.3s ease-out',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#5b72f2', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🔔 New Notification
        </span>
        <button 
          onClick={handleClose} 
          style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#94a3b8' }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span>{notification.message}</span>
        <VerifiedBadge status={senderObj?.verificationStatus} size="0.85rem" />
      </div>

      {/* Progress Bar visual indicator for 60-second countdown */}
      <div style={{ width: '100%', height: '3px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
        <div style={{
          height: '100%',
          background: '#5b72f2',
          width: '100%',
          animation: 'shrinkBar 60s linear forwards'
        }} />
      </div>
      <style>{`
        @keyframes shrinkBar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

export default NotificationPopup;
