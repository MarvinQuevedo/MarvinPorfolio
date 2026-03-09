import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Bot, User, Cpu } from 'lucide-react';

const renderText = (text) => {
  // Very basic markdown link parsing [Text](url)
  const parts = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)|(http[s]?:\/\/[^\s]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex}>{text.substring(lastIndex, match.index)}</span>);
    }
    
    if (match[1] && match[2]) {
      // It's a markdown link
      parts.push(
        <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer">
          {match[1]}
        </a>
      );
    } else if (match[3]) {
      // It's a raw URL
      parts.push(
        <a key={match.index} href={match[3]} target="_blank" rel="noopener noreferrer">
          {match[3]}
        </a>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={lastIndex}>{text.substring(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : text;
};

export default function Chat() {
  const [language, setLanguage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (language) {
      const fetchProducts = () => {
        axios.get('http://localhost:3001/api/products')
          .then(res => setProducts(res.data))
          .catch(console.log);
      };
      fetchProducts();
      const interval = setInterval(fetchProducts, 3000);
      return () => clearInterval(interval);
    }
  }, [language]);

  // Polling for pending order payment
  useEffect(() => {
    if (!pendingOrderId) return;
    
    const checkPayment = async () => {
      try {
        const { data } = await axios.get(`http://localhost:3001/api/orders/${pendingOrderId}`);
        if (data.status === 'Paid / Processing') {
          // Tell the AI to confirm the payment natively
          handleSend(`(SYSTEM: The order ${pendingOrderId} has been PAID successfully. Please reply with EXACTLY this sentence: "Tu pedido **${pendingOrderId}** está **Pagado / En Proceso**." and add a short, friendly thank you message below it.)`, true);
          setPendingOrderId(null); // Stop polling
        }
      } catch (e) {}
    };

    const intervalId = setInterval(checkPayment, 3000);
    return () => clearInterval(intervalId);
  }, [pendingOrderId]);

  const startChat = (lang) => {
    setLanguage(lang);
    
    let initialMessage = '';
    if (lang === 'Spanish') initialMessage = '¡Hola! Soy tu asistente virtual. Puedo ayudarte a buscar productos y realizar compras. ¿En qué te puedo ayudar hoy?';
    else if (lang === 'English') initialMessage = 'Hello! I am your virtual assistant. I can help you find products and make purchases. How can I help you today?';
    else if (lang === 'French') initialMessage = 'Bonjour! Je suis votre assistant virtuel. Je peux vous aider à trouver des produits et faire des achats. Comment puis-je vous aider aujourd\'hui?';
    else initialMessage = 'Hello! How can I help you today?';

    setMessages([{ role: 'bot', content: initialMessage }]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text, isHidden = false) => {
    if (!text.trim() || isLoading) return;

    const userMessage = { role: 'user', content: text, isHidden };
    
    // Only display user message if it's not a SYSTEM hidden auto-prompt
    if (!isHidden) {
      setMessages(prev => [...prev, userMessage]);
    }
    setIsLoading(true);

    // Map messages payload
    const payloadMessages = [...messages, userMessage].map(m => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.content
    }));

    try {
      const { data } = await axios.post('http://localhost:3001/api/chat', {
        messages: payloadMessages,
        language: language
      });
      
      const botResponse = data.message;
      setMessages(prev => [...prev, { role: 'bot', content: botResponse.content }]);
      
      // Auto-detect if AI just sent a payment link
      const match = botResponse.content.match(/http:\/\/localhost:5173\/pay\/([A-Z0-9\-]+)/);
      if (match && match[1]) {
        setPendingOrderId(match[1]);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: error.response?.data?.error || 'Oops, error processing request.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const currInput = input;
    setInput('');
    handleSend(currInput);
  };

  const simulateAdClick = (product) => {
    const msgMsg = `Hola, vengo de Facebook, vi un anuncio sobre el producto "${product.name}" y me interesa comprarlo. ¿Aún tienen disponibilidad?`;
    handleSend(msgMsg);
  };

  if (!language) {
    return (
      <div className="glass-panel center-card" style={{ maxWidth: 400 }}>
        <Cpu size={48} color="var(--primary)" />
        <h2>Select Language</h2>
        <p>Please choose your preferred language to continue</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1.5rem', width: '100%' }}>
          <button className="primary-btn" onClick={() => startChat('Spanish')} style={{ margin: 0 }}>Español</button>
          <button className="primary-btn" onClick={() => startChat('English')} style={{ margin: 0, background: 'rgba(255,255,255,0.1)' }}>English</button>
          <button className="primary-btn" onClick={() => startChat('French')} style={{ margin: 0, background: 'rgba(255,255,255,0.1)' }}>Français</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', maxWidth: '1200px', height: '90vh' }}>
      <div className="chat-window glass-panel" style={{ flex: 2, height: '100%' }}>
        <div className="chat-header">
          <h1><Cpu size={24} color="var(--primary)" /> Store AI Agent</h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Powered by Ollama
          </div>
        </div>

        <div className="chat-messages">
          {messages.filter(m => !m.isHidden).map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8rem', opacity: 0.8, color: msg.role === 'bot' ? 'var(--primary)' : 'var(--secondary)' }}>
                {msg.role === 'bot' ? <Bot size={16} /> : <User size={16} />}
                {msg.role === 'bot' ? 'Assistant' : 'You'}
              </div>
              <div>
                {msg.content.split('\n').map((line, i) => (
                  <p key={i} style={{ minHeight: line.trim() === '' ? '1rem' : 'auto' }}>
                    {renderText(line)}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message bot">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8rem', opacity: 0.8, color: 'var(--primary)' }}>
                <Bot size={16} /> Assistant
              </div>
              <div className="loading-dots">
                <div></div><div></div><div></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-area" onSubmit={onSubmit}>
          <textarea 
            className="chat-input" 
            placeholder="Escribe un mensaje aquí... (Enter para enviar, Ctrl+Enter para nueva línea)" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            disabled={isLoading}
            style={{ resize: 'none', height: '60px', fontFamily: 'inherit' }}
          />
          <button type="submit" className="send-btn" disabled={!input.trim() || isLoading}>
            <Send size={20} />
          </button>
        </form>
      </div>

      <div className="glass-panel" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>📢 Facebook Ads</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Simula que el cliente hace clic en un anuncio de Facebook.</p>
        
        {products.map(p => (
          <div key={p.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <img src={p.image} alt={p.name} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />
            <h4 style={{ margin: 0 }}>{p.name}</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>${p.price}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Inv: {p.inventory}</span>
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
      </div>
    </div>
  );
}
