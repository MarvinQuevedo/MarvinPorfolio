# Proyecto: AI Radio Internet - Walkthrough

Este proyecto implementa una radio por internet completamente automatizada con integración de solicitudes de canciones, mensajería en tiempo real y publicidad programada.

## Componentes Implementados

### 1. Motor de Audio (Liquidsoap)
Se ha creado el archivo [radio.liq](file:///Users/marvin/Projects/MarvinPorfolio/internet-radio-ai/server/radio.liq) que gestiona:
- Una lista de reproducción de respaldo.
- Una cola dinámica para peticiones (`request.queue`).
- Rotación automática de publicidad tras cada 4 canciones.
- Salida compatible con Icecast (`radio.mp3`).

### 2. Servidor de Orquestación (Node.js + Socket.io)
El archivo [server.ts](file:///Users/marvin/Projects/MarvinPorfolio/internet-radio-ai/server/src/server.ts) actúa como el cerebro:
- **API REST**: Procesa los enlaces de YouTube y los envía a la cola de Liquidsoap vía Telnet.
- **WebSocket**: Sincroniza el chat en vivo entre todos los oyentes.

### 3. Interfaz de Usuario (React + Tailwind)
Una UI premium con modo oscuro:
- Reproductor de audio integrado que conecta con el stream.
- Formulario de petición de canciones.
- Chat en vivo con animaciones.

## Guía de Instalación y Ejecución

### Requisitos Previos
```bash
brew install liquidsoap icecast yt-dlp
```

### Pasos para reproducir
1.  **Iniciar Icecast**: `icecast -c icecast.xml` (debe estar configurado en el puerto 8000).
2.  **Iniciar el Motor de Audio**: 
    ```bash
    liquidsoap /Users/marvin/Projects/MarvinPorfolio/internet-radio-ai/server/radio.liq
    ```
3.  **Iniciar el Servidor Backend**:
    ```bash
    cd server && npm run dev
    ```
4.  **Iniciar el Cliente Frontend**:
    ```bash
    cd client && npm run dev
    ```

## Flujo de Trabajo Demostrado
- Un usuario ingresa al sitio.
- Escucha el stream de radio. mp3 (compatible con VLC/Winamp).
- Envía un mensaje en el chat que aparece instantáneamente para otros usuarios.
- Pega un link de YouTube; el backend lo procesa y Liquidsoap lo añade a la cola de reproducción "En Vivo".
