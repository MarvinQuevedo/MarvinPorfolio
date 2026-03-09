import React from 'react';

export default function OrdersPanel({ orders, updateOrderStatus }) {
  return (
    <>
      <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginTop: '1rem' }}>📦 Admin Dashboard</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lista de pedidos y cambio de estados.</p>
      
      {orders.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No hay pedidos todavía.</p>
      ) : (
        [...orders].reverse().map(o => (
          <div key={o.trackId} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{o.trackId}</span>
              <span style={{ fontSize: '0.8rem', color: o.status === 'Pendiente de Pago' || o.status === 'Pending Payment' ? 'orange' : 'var(--primary)' }}>
                {o.status}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {new Date(o.createdAt).toLocaleString()}
            </div>
            <span style={{ fontSize: '0.85rem' }}>{o.name} - <b>{o.productName}</b> (${o.amount})</span>
            
            <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.7rem' }}>
              <strong>Historial:</strong>
              {o.history && o.history.map((h, i) => (
                <div key={i}>• {h.status} ({new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                className="primary-btn" 
                style={{ padding: '0.4rem', fontSize: '0.75rem', flex: 1 }}
                onClick={() => updateOrderStatus(o.trackId, 'Enviado')}
                disabled={o.status === 'Enviado' || o.status === 'Shipped'}
              >
                Env.
              </button>
              <button 
                className="primary-btn" 
                style={{ padding: '0.4rem', fontSize: '0.75rem', flex: 1 }}
                onClick={() => updateOrderStatus(o.trackId, 'Entregado')}
                disabled={o.status === 'Entregado' || o.status === 'Delivered'}
              >
                Entg.
              </button>
            </div>
          </div>
        ))
      )}
    </>
  );
}
