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

# 1. Iniciar Ollama (forzado)
echo "🤖 Verificando Ollama..."

if ! command -v ollama &> /dev/null; then
    echo "❌ Error: 'ollama' no está instalado o no está en el PATH."
    echo "   Instálalo desde https://ollama.com/download"
    exit 1
fi

# Reiniciar ollama si ya está corriendo, o iniciarlo
if pgrep -x "ollama" > /dev/null; then
    echo "🔄 Deteniendo proceso actual de Ollama para reiniciarlo..."
    pkill -x "ollama" 2>/dev/null || killall ollama 2>/dev/null
    sleep 2
fi

echo "🚀 Iniciando Ollama en segundo plano..."
ollama serve > "$ROOT_DIR/ollama.log" 2>&1 &
OLLAMA_PID=$!
echo $OLLAMA_PID > "$ROOT_DIR/.ollama.pid"

# Esperar a que la API de Ollama esté lista
echo "⏳ Esperando a que Ollama esté listo..."
OLLAMA_READY=0
for i in $(seq 1 15); do
    if curl -s http://localhost:11434 > /dev/null 2>&1; then
        OLLAMA_READY=1
        break
    fi
    sleep 1
done

if [ $OLLAMA_READY -eq 0 ]; then
    echo "❌ Error: Ollama no respondió después de 15 segundos. Revisa ollama.log"
    exit 1
fi
echo "✅ Ollama listo en http://localhost:11434"

# Leer el modelo desde .env o usar 'mistral' como fallback
OLLAMA_MODEL_NAME=$(grep -E '^OLLAMA_MODEL=' "$ROOT_DIR/backend/.env" 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'")
OLLAMA_MODEL_NAME="${OLLAMA_MODEL_NAME:-qwen2.5:7b}"

# Verificar si el modelo ya está disponible localmente
echo "🔍 Verificando modelo Ollama: $OLLAMA_MODEL_NAME..."
if ollama list 2>/dev/null | grep -q "^${OLLAMA_MODEL_NAME}"; then
    echo "✅ Modelo '$OLLAMA_MODEL_NAME' ya está disponible."
else
    echo "📥 Descargando modelo '$OLLAMA_MODEL_NAME' (esto puede tardar unos minutos la primera vez)..."
    if ollama pull "$OLLAMA_MODEL_NAME"; then
        echo "✅ Modelo '$OLLAMA_MODEL_NAME' descargado correctamente."
    else
        echo "❌ Error: No se pudo descargar el modelo '$OLLAMA_MODEL_NAME'."
        echo "   Verifica el nombre del modelo en https://ollama.com/library"
        exit 1
    fi
fi

# 2. Iniciar el Backend (forzando AI_PROVIDER=ollama, ignorando el .env)
echo "⚡ Iniciando Backend en el puerto 3001 (AI_PROVIDER=ollama)..."
(cd "$ROOT_DIR/backend" && AI_PROVIDER=ollama node server.js > "$ROOT_DIR/backend.log" 2>&1) &
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
