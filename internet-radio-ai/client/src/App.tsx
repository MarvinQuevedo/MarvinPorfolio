import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Play, Pause, Send, Music2, MessageSquare, Radio as RadioIcon } from 'lucide-react';

const socket = io('http://localhost:3001');

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState<{ user: string, text: string }[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [songRequest, setSongRequest] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    socket.on('receive_message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    return () => {
      socket.off('receive_message');
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      socket.emit('send_message', { user: 'Listener', text: messageInput });
      setMessageInput('');
    }
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (songRequest.trim()) {
      try {
        const response = await fetch('http://localhost:3001/api/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: songRequest })
        });
        const data = await response.json();
        alert(data.message || data.error);
        setSongRequest('');
      } catch (err) {
        console.error('Request error:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-purple-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RadioIcon className="w-8 h-8 text-purple-500 animate-pulse" />
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              AI RADIO INTERNET
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span> EN VIVO</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Player Section */}
        <div className="lg:col-span-2 space-y-8">
          <div className="relative aspect-video rounded-3xl overflow-hidden group bg-gradient-to-br from-purple-900/20 to-slate-900 border border-white/10 shadow-2xl">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-40 group-hover:scale-105 transition-transform duration-700"></div>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-black/40">
              <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mb-6 hover:scale-110 transition-transform cursor-pointer shadow-purple-500/20 shadow-2xl" onClick={togglePlay}>
                {isPlaying ? <Pause className="w-10 h-10 fill-white" /> : <Play className="w-10 h-10 fill-white ml-1" />}
              </div>
              <h2 className="text-3xl font-bold mb-2">Sintonizando al Futuro</h2>
              <p className="text-slate-400 max-w-md">Tu IA, tu música, tu radio. Pide una canción abajo.</p>
              
              <audio ref={audioRef} src="http://localhost:8000/radio.mp3" crossOrigin="anonymous" />
            </div>
          </div>

          {/* Song Request Form */}
          <div className="p-8 rounded-3xl bg-slate-900/50 border border-white/5 backdrop-blur-sm shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Music2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold">Programar Canción</h3>
            </div>
            <form onSubmit={submitRequest} className="space-y-4">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="URL de YouTube Music..." 
                  value={songRequest}
                  onChange={(e) => setSongRequest(e.target.value)}
                  className="w-full h-14 bg-slate-800/50 border border-white/10 rounded-xl px-6 outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-2 h-10 px-6 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors"
                >
                  Pedir
                </button>
              </div>
              <p className="text-sm text-slate-500">Aceptamos links de YouTube y YouTube Music.</p>
            </form>
          </div>
        </div>

        {/* Messaging Sidebar */}
        <div className="flex flex-col h-[700px] rounded-3xl bg-slate-900/50 border border-white/5 backdrop-blur-sm shadow-xl relative overflow-hidden">
          <div className="p-6 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-pink-400" />
              <h3 className="font-semibold">Chat en Vivo</h3>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center">
                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                <p>No hay mensajes aún.<br/>¡Sé el primero!</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className="animate-in slide-in-from-bottom-2 duration-300">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">{msg.user}</span>
                  <div className="mt-1 p-3 rounded-2xl bg-white/5 border border-white/5 text-slate-200">
                    {msg.text}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 bg-black/40 border-t border-white/5">
            <form onSubmit={sendMessage} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Escribe algo..." 
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="flex-1 h-11 bg-slate-800/50 border border-white/10 rounded-lg px-4 outline-none focus:ring-1 focus:ring-purple-500/50 transition-all text-sm"
              />
              <button 
                type="submit"
                className="w-11 h-11 flex items-center justify-center bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="mt-12 py-12 border-t border-white/5 text-center text-slate-500 text-sm">
        <p>&copy; 2026 AI Radio Internet. Generado por Antigravity.</p>
      </footer>
    </div>
  );
};

export default App;
