import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Bot, User, Cpu } from 'lucide-react';
import ProductsPanel from './ProductsPanel';
import OrdersPanel from './OrdersPanel';

const renderText = (text) => {
  // Very basic markdown parsing for Links, URLs, Bold and Images
  const parts = [];
  // Regex includes groups for markdown links, raw urls, and bold text
  const regex = /\[([^\]]+)\]\(([^)]+)\)|(http[s]?:\/\/[^\s]+)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex}>{text.substring(lastIndex, match.index)}</span>);
    }
    
    if (match[1] && match[2]) {
      // Markdown link [text](url)
      parts.push(
        <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer">
          {match[1]}
        </a>
      );
    } else if (match[3]) {
      const url = match[3];
      // Check if URL is an image
      if (url.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i)) {
        parts.push(
          <div key={match.index} style={{ margin: '0.5rem 0' }}>
            <img src={url} alt="Content" style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
          </div>
        );
      } else {
        // Raw URL
        parts.push(
          <a key={match.index} href={url} target="_blank" rel="noopener noreferrer">
            {url}
          </a>
        );
      }
    } else if (match[4] || match[5]) {
      // Bold text **Text** or *Text*
      parts.push(
        <strong key={match.index} style={{ color: 'var(--primary)' }}>
          {match[4] || match[5]}
        </strong>
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
  const [orders, setOrders] = useState([]);
  // Set of trackIds whose chat is still open and listening for updates
  const [trackedOrders, setTrackedOrders] = useState(new Set());
  // Quick-reply chips parsed from the last bot message
  const [suggestedReplies, setSuggestedReplies] = useState([]);
  const messagesEndRef = useRef(null);
  // Keep ref to language so SSE callbacks always see current value
  const languageRef = useRef(language);
  
  const [config, setConfig] = useState(null);
  const [selectedModel, setSelectedModel] = useState('');

  useEffect(() => {
    axios.get('http://localhost:3001/api/config')
      .then(res => {
        setConfig(res.data);
        if (res.data.models && res.data.models.length > 0) {
          setSelectedModel(res.data.models[0]);
        }
      })
      .catch(console.log);
  }, []);

  useEffect(() => { languageRef.current = language; }, [language]);

  useEffect(() => {
    if (language) {
      const fetchData = () => {
        axios.get('http://localhost:3001/api/products')
          .then(res => setProducts(res.data.products ?? res.data))
          .catch(console.log);

        axios.get('http://localhost:3001/api/orders')
          .then(res => setOrders(res.data))
          .catch(console.log);
      };
      fetchData();
      const interval = setInterval(fetchData, 3000);
      return () => clearInterval(interval);
    }
  }, [language]);

  // ─── SSE: Real-time order event listener ───────────────────────────────────
  useEffect(() => {
    if (trackedOrders.size === 0) return;

    const eventSources = [];

    for (const trackId of trackedOrders) {
      const es = new EventSource(`http://localhost:3001/api/orders/${trackId}/events`);

      const handlePaid = (e) => {
        const data = JSON.parse(e.data);
        const lang = languageRef.current;
        const msg = lang === 'Spanish'
          ? `✅ ¡Tu pago fue recibido exitosamente! Tu pedido **${data.trackId}** ahora está en estado **Pagado / En Proceso**. ¡Gracias por tu compra! Pronto te enviaremos tu pedido.`
          : `✅ Your payment was received! Order **${data.trackId}** is now **Paid / Processing**. Thank you for your purchase!`;
        setMessages(prev => [...prev, { role: 'bot', content: msg }]);
        // Stop tracking this order
        setTrackedOrders(prev => { const s = new Set(prev); s.delete(trackId); return s; });
        es.close();
        // Refresh admin panel
        axios.get('http://localhost:3001/api/orders').then(res => setOrders(res.data)).catch(() => {});
      };

      const handleStatusUpdate = (e) => {
        const data = JSON.parse(e.data);
        const lang = languageRef.current;
        const STATUS_LABELS = {
          'Enviado':    lang === 'Spanish' ? 'Enviado 🙩' : 'Shipped 🙩',
          'Entregado':  lang === 'Spanish' ? 'Entregado ✅' : 'Delivered ✅',
          'Shipped':    lang === 'Spanish' ? 'Enviado 🙩' : 'Shipped 🙩',
          'Delivered':  lang === 'Spanish' ? 'Entregado ✅' : 'Delivered ✅',
        };
        const label = STATUS_LABELS[data.status] || data.status;
        const msg = lang === 'Spanish'
          ? `📦 Tu pedido **${data.trackId}** ha sido actualizado: **${label}**.`
          : `📦 Your order **${data.trackId}** status updated: **${label}**.`;
        setMessages(prev => [...prev, { role: 'bot', content: msg }]);
        // Refresh admin panel
        axios.get('http://localhost:3001/api/orders').then(res => setOrders(res.data)).catch(() => {});
      };

      es.addEventListener('order_paid', handlePaid);
      es.addEventListener('status_updated', handleStatusUpdate);
      es.onerror = () => { /* connection closed or server restarted – silently ignore */ };

      eventSources.push(es);
    }

    return () => {
      eventSources.forEach(es => es.close());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedOrders]);

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

  // ─── Quick-reply chips ───────────────────────────────────────────────
  function extractSuggestedReplies(text, lang) {
    // ─ Stage 1: explicit (1) X  (2) Y pattern ────────────────────────────
    const explicit = [...text.matchAll(/\(\d+\)\s*([^(\n]+)/g)]
      .map(m => m[1].trim())
      .filter(s => s.length > 0 && s.length < 60);
    if (explicit.length >= 2) return explicit;

    // ─ Stage 2: fallback — detect yes/no questions even without (1)/(2) ────────
    const isSpanish = lang === 'Spanish';
    // The message must end with '?' (possibly with trailing whitespace)
    const endsWithQuestion = /\?\s*$/.test(text);
    if (!endsWithQuestion) return [];

    // Keywords that signal a purchase / help / confirmation question
    const purchaseKW  = /compra|proceder|adquirir|pedir|ordenar|comprar|purchase|proceed|buy/i;
    const helpKW      = /ayudar|ayudo|asistir|assist|help|algo más|anything else|more/i;
    const detailKW    = /detalles|detail|más información|more info|saber más|know more/i;

    if (purchaseKW.test(text) || detailKW.test(text)) {
      return isSpanish
        ? ['Sí, quiero comprarlo', 'No, gracias']
        : ['Yes, I want to buy it', 'No, thanks'];
    }
    if (helpKW.test(text)) {
      return isSpanish
        ? ['Sí, necesito ayuda', 'No, gracias']
        : ['Yes, please', 'No, thanks'];
    }
    // Generic yes/no question fallback
    if (/\?/.test(text)) {
      return isSpanish ? ['Sí', 'No, gracias'] : ['Yes', 'No, thanks'];
    }
    return [];
  }

  const handleSend = async (text, isHidden = false) => {
    if (!text.trim() || isLoading) return;
    setSuggestedReplies([]); // Clear chips on every send

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
        language: language,
        model: selectedModel
      });
      
      const botResponse = data.message;
      setMessages(prev => [...prev, { role: 'bot', content: botResponse.content }]);

      // Extract quick-reply suggestions from the response (pass language for fallback chips)
      const chips = extractSuggestedReplies(botResponse.content, language);
      if (chips.length >= 2) setSuggestedReplies(chips);

      // Auto-detect if AI just sent a payment link → subscribe via SSE
      const match = botResponse.content.match(/http:\/\/localhost:5173\/pay\/([A-Z0-9\-]+)/);
      if (match && match[1]) {
        setTrackedOrders(prev => new Set([...prev, match[1]]));
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

  const updateOrderStatus = async (trackId, newStatus) => {
    try {
      await axios.put(`http://localhost:3001/api/orders/${trackId}/status`, { status: newStatus });
      // Refresh orders right away
      const { data } = await axios.get('http://localhost:3001/api/orders');
      setOrders(data);
    } catch (e) {
      console.error(e);
    }
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
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', maxWidth: '1600px', height: '90vh', margin: '0 auto' }}>
      <div className="chat-window glass-panel" style={{ flex: 2, height: '100%' }}>
        <div className="chat-header">
          <h1><Cpu size={24} color="var(--primary)" /> Store AI Agent</h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Powered by {config?.provider === 'ollama' ? 'Ollama' : 'DeepSeek'} 
            {config?.models && config.models.length > 1 && config.provider === 'ollama' && (
              <select 
                value={selectedModel} 
                onChange={e => setSelectedModel(e.target.value)}
                style={{ marginLeft: '10px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 5px', fontFamily: 'inherit' }}
              >
                {config.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
            {((config?.models && config.models.length === 1) || config?.provider === 'deepseek') && (
               <span style={{ marginLeft: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 5px' }}>
                 {config?.models?.[0] || selectedModel || 'deepseek-chat'}
               </span>
            )}
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

          {/* Quick-reply chips */}
          {!isLoading && suggestedReplies.length >= 2 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
              padding: '0.5rem 0.75rem', justifyContent: 'flex-start'
            }}>
              {suggestedReplies.map((reply, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(reply)}
                  disabled={isLoading}
                  style={{
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1px solid rgba(139, 92, 246, 0.5)',
                    borderRadius: '20px',
                    padding: '0.45rem 1rem',
                    color: 'var(--primary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.35)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {idx + 1 === 1 ? '✅' : '❌'} {reply}
                </button>
              ))}
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

      <div style={{ flex: 2, display: 'flex', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', height: '100%' }}>
          <ProductsPanel products={products} simulateAdClick={simulateAdClick} isLoading={isLoading} />
        </div>
        <div className="glass-panel" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', height: '100%' }}>
          <OrdersPanel orders={orders} updateOrderStatus={updateOrderStatus} />
        </div>
      </div>
    </div>
  );
}
