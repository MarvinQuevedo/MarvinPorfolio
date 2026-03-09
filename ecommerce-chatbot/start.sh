#!/bin/bash

# Obtener la ruta absoluta del directorio donde está el script
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Iniciando Chatbot de E-commerce..."

# Verificar si node_modules existe, si no, instalar
if [ ! -d "$ROOT_DIR/backend/node_modules" ]; then
    echo "📦 Instalando dependencias del Backend..."
    (cd "$ROOT_DIR/backend" && npm install)
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    echo "📦 Instalando dependencias del Frontend..."
    (cd "$ROOT_DIR/frontend" && npm install)
fi

# 1. Iniciar el Backend
echo "⚡ Iniciando Backend en el puerto 3001..."
(cd "$ROOT_DIR/backend" && node server.js > "$ROOT_DIR/backend.log" 2>&1) &
BACKEND_PID=$!
echo $BACKEND_PID > "$ROOT_DIR/.backend.pid"

# 2. Iniciar el Frontend
echo "🎨 Iniciando Frontend en el puerto 5173..."
(cd "$ROOT_DIR/frontend" && npm run dev > "$ROOT_DIR/frontend.log" 2>&1) &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$ROOT_DIR/.frontend.pid"

echo "✅ Todos los servicios están corriendo en segundo plano."
echo "▶️  Frontend App: http://localhost:5173"
echo "▶️  Backend API : http://localhost:3001"
echo ""
echo "📝 Logs de Backend: backend.log"
echo "📝 Logs de Frontend: frontend.log"
echo ""
echo "Para detener los servicios, ejecuta: ./stop.sh"
