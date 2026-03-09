import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CreditCard, CheckCircle, Package } from 'lucide-react';

export default function Pay() {
  const { trackId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`http://localhost:3001/api/orders/${trackId}`)
      .then(res => {
        setOrder(res.data);
        if (res.data.status !== 'Pendiente de Pago') setPaid(true);
        setLoading(false);
      })
      .catch(err => {
        setError('Order not found or an error occurred.');
        setLoading(false);
      });
  }, [trackId]);

  const handlePay = () => {
    setPaying(true);
    axios.post(`http://localhost:3001/api/orders/${trackId}/pay`)
      .then(res => {
        setPaid(true);
        setPaying(false);
      })
      .catch(err => {
        setError('Payment simulation failed.');
        setPaying(false);
      });
  };

  if (loading) return <div className="glass-panel center-card"><div className="loading-dots"><div></div><div></div><div></div></div></div>;
  if (error) return <div className="glass-panel center-card"><p>{error}</p><Link className="back-link" to="/">Return to chat</Link></div>;

  return (
    <div className="glass-panel center-card">
      <Package size={48} color="var(--primary)" />
      <h2>Simulate Checkout</h2>
      <p>Pay for order <strong>#{trackId}</strong></p>
      
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', width: '100%', textAlign: 'left', margin: '1rem 0' }}>
        <p><strong>Item:</strong> Product ID {order.productId}</p>
        <p><strong>Total:</strong> ${order.amount}</p>
        <p><strong>Client:</strong> {order.name} ({order.phone})</p>
        <p><strong>Shipping to:</strong> {order.address}</p>
      </div>

      {!paid ? (
        <button className="primary-btn" onClick={handlePay} disabled={paying} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <CreditCard size={20} />
          {paying ? 'Processing...' : `Pay $${order.amount}`}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <CheckCircle size={48} color="#22c55e" />
          <h3 style={{ color: '#22c55e' }}>¡Pago Exitoso!</h3>
          <p>You can now return to the chat.</p>
        </div>
      )}

      <Link className="back-link" to="/">← Return to chat</Link>
    </div>
  );
}
