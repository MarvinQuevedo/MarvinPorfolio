import React from 'react';

export default function ProductsPanel({ products, simulateAdClick, isLoading }) {
  return (
    <>
      <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>📢 Facebook Ads</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Simula que el cliente hace clic en un anuncio de Facebook.</p>
      
      {products.map(p => (
        <div key={p.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <img src={p.image} alt={p.name} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />
          <h4 style={{ margin: 0 }}>{p.name}</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>${p.price}</span>
          </div>
          <button 
            className="primary-btn" 
            style={{ padding: '0.6rem', fontSize: '0.9rem', marginTop: '0.5rem' }}
            onClick={() => simulateAdClick(p)}
            disabled={isLoading}
          >
            Simular Clic en Anuncio
          </button>
        </div>
      ))}
    </>
  );
}
