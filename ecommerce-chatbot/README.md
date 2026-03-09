# e-Commerce Chatbot AI

A modern, dynamic chat web app that connects to a local Node.js server to use AI (Ollama). The chatbot can list store products, collect user details to generate a simulated payment link, check order status based on a tracking code, and simulate tracking status updates.

## Tecnologías Utilizadas
- **Frontend**: React, Vite, React Router, Lucide Icons, CSS3.
- **Backend**: Node.js, Express, Axios, uuid.
- **AI**: Ollama (llama 3.2 function calling).

## Ejecutar el Proyecto

Este proyecto asume que tienes **Ollama** instalado y corriendo con el modelo `llama3.2` (o `llama3`). 

### 1. Iniciar el Backend
Desde la raíz del proyecto, entra al directorio backend:
```bash
cd backend
npm install
node server.js
```
El servidor Node.js iniciará en el puerto 3001.

### 2. Iniciar el Frontend
En otra terminal, corre:
```bash
cd frontend
npm install # si aún no lo has hecho
npm run dev
```
La app se abrirá en `http://localhost:5173`.

## Flujo Recomendado de Pruebas
1. Escribe en el chat: `"Quiero ver los productos disponibles"`.
2. El bot utilizará una herramienta para leer la base de datos mock (`products.js`) y te listará las opciones.
3. Dile al bot: `"Quiero comprar el Smartphone X. Mi nombre es Juan Perez, vivo en Calle Falsa 123 y mi teléfono es 555-0199"`.
4. El bot creará la orden y enviará un **Enlace de Pago**.
5. Haz clic en el enlace, se abrirá una nueva pestaña con la interfaz de "Simular Pago". Haz clic en **Pagar**, lo cual actualizará el estado de la orden internamente y retornará éxito.
6. Cierra la pestaña y dile al bot: `"Ya lo pague, ¿cuál es mi código de rastreo y estado?"` o entra manualmente a la ruta `/track/:tu-codigo`.
7. Desde la página de rastreo (`/track/:tu-codigo`), podrás visualizar la información y simular una actualización del estado (ej. de "Paid" a "Shipped").
