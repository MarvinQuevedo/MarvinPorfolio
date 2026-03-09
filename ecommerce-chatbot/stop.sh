#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🛑 Deteniendo servicios del E-commerce Chatbot..."

# 1. Detener Backend almacenado en .backend.pid
if [ -f "$ROOT_DIR/.backend.pid" ]; then
    BACKEND_PID=$(cat "$ROOT_DIR/.backend.pid")
    echo "🔸 Deteniendo proceso Backend con PID $BACKEND_PID..."
    kill $BACKEND_PID 2>/dev/null
    rm "$ROOT_DIR/.backend.pid"
else
    echo "🔸 PID de Backend no encontrado..."
fi

# 2. Detener Frontend almacenado en .frontend.pid (Vite levanta procesos hijos)
if [ -f "$ROOT_DIR/.frontend.pid" ]; then
    FRONTEND_PID=$(cat "$ROOT_DIR/.frontend.pid")
    echo "🔸 Deteniendo procesos Frontend (y subprocesos Vite) con GID $FRONTEND_PID..."
    # kill -9 -PID a veces es riesgoso en macOS, usamos pkill para subprocesos
    pkill -P $FRONTEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    rm "$ROOT_DIR/.frontend.pid"
else
    echo "🔸 PID de Frontend no encontrado..."
fi

# 3. Forzar el cierre de cualquier proceso residual en los puertos que usamos por seguridad
echo "🧹 Limpiando puertos residuales (3001, 5173)..."
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo "✅ Todos los servicios han sido detenidos correctamente."
