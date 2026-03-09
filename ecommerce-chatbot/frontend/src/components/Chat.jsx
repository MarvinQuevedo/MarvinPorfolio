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
  const [messages, setMessages] = useState([
    { role: 'bot', content: '¡Hola! Soy tu asistente virtual. Puedo ayudarte a buscar productos y realizar compras. ¿En qué te puedo ayudar hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Convert to API format (excluding our local 'bot'/'user' mapping if needed, Ollama uses 'assistant' and 'user')
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Map messages payload
    const payloadMessages = [...messages, userMessage].map(m => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.content
    }));

    try {
      const { data } = await axios.post('http://localhost:3001/api/chat', {
        messages: payloadMessages
      });
      
      const botResponse = data.message;
      setMessages(prev => [...prev, { role: 'bot', content: botResponse.content }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: error.response?.data?.error || 'Oops, ocurrió un error al procesar tu solicitud. Asegúrate de que el backend y Ollama estén corriendo.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-window glass-panel">
      <div className="chat-header">
        <h1><Cpu size={24} color="var(--primary)" /> Store AI Agent</h1>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Powered by Ollama
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
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

      <form className="chat-input-area" onSubmit={sendMessage}>
        <input 
          type="text" 
          className="chat-input" 
          placeholder="Escribe un mensaje aquí..." 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button type="submit" className="send-btn" disabled={!input.trim() || isLoading}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
