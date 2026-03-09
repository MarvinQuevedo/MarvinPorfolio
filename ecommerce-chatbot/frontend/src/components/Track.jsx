import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, MapPin, RefreshCw } from 'lucide-react';

export default function Track() {
  const { trackId: paramId } = useParams();
  const [trackId, setTrackId] = useState(paramId || '');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchOrder = (id) => {
    setLoading(true);
    setError(null);
    axios.get(`http://localhost:3001/api/orders/${id}`)
      .then(res => {
        setOrder(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError('Order not found.');
        setOrder(null);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (paramId) {
      fetchOrder(paramId);
    }
  }, [paramId]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (trackId) {
      navigate(`/track/${trackId}`);
      fetchOrder(trackId);
    }
  };

  const simulateUpdate = (status) => {
    axios.post(`http://localhost:3001/api/orders/${order.trackId}/update-status`, { status })
      .then(res => {
        setOrder(res.data.order);
      })
      .catch(err => alert("Error updating status"));
  };

  return (
    <div className="glass-panel center-card">
      <MapPin size={48} color="var(--primary)" />
      <h2>Track Order</h2>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
        <input 
          type="text"
          value={trackId}
          onChange={(e) => setTrackId(e.target.value)}
          placeholder="Enter Tracking ID..."
          style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: 'none', outline: 'none', background: 'rgba(0,0,0,0.2)', color: 'white' }}
        />
        <button type="submit" style={{ background: 'var(--primary)', border: 'none', borderRadius: '8px', padding: '0.8rem', cursor: 'pointer', color: 'white' }}>
          <Search size={20} />
        </button>
      </form>

      {loading && <div className="loading-dots" style={{ margin: '2rem 0' }}><div></div><div></div><div></div></div>}
      
      {error && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{error}</p>}

      {order && !loading && (
        <div style={{ width: '100%', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', textAlign: 'left', marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Order #{order.trackId}</h3>
          <p><strong>Status:</strong> <span className="status-badge">{order.status}</span></p>
          <p style={{ marginTop: '0.5rem' }}><strong>Product:</strong> {order.productId}</p>
          <p><strong>Name:</strong> {order.name}</p>
          
          <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Simulate Status Update:</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['Shipped', 'Out for delivery', 'Delivered'].map(s => (
                <button 
                  key={s}
                  onClick={() => simulateUpdate(s)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '0.4rem 0.8rem', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Link className="back-link" to="/">← Return to chat</Link>
    </div>
  );
}
