import React from 'react';

function VerifiedBadge({ status, size = '1rem' }) {
  if (status !== 'verified') return null;

  return (
    <span 
      title="Verified Account"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
        color: '#fff',
        borderRadius: '50%',
        width: size,
        height: size,
        fontSize: `calc(${size} * 0.6)`,
        marginLeft: '5px',
        verticalAlign: 'middle',
        boxShadow: '0 2px 4px rgba(37,99,235,0.3)',
        userSelect: 'none'
      }}
    >
      ★
    </span>
  );
}

export default VerifiedBadge;
