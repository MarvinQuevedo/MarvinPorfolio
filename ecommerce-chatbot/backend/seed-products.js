/**
 * seed-products.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bootstrap / refill de inventario para la base de datos del e-commerce chatbot.
 *
 * Uso:
 *   node seed-products.js           → inserta solo productos que no existan
 *   node seed-products.js --refill  → actualiza SOLO el inventario de todos
 *   node seed-products.js --reset   → borra todos los productos y reinserta todo
 *
 * Funciona independientemente si el servidor está corriendo o no.
 */

const Database = require('better-sqlite3');
const path = require('path');

// ─── Argumentos CLI ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const MODE_REFILL = args.includes('--refill');
const MODE_RESET  = args.includes('--reset');

// ─── Conexión directa a la DB ─────────────────────────────────────────────────
const dbPath = path.resolve(__dirname, '../data.db');
const db = new Database(dbPath);

// Asegurarnos de que la tabla exista
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    inventory INTEGER NOT NULL,
    image TEXT,
    brand TEXT
  );
`);

// Agregar columna brand si no existe (migración suave)
try {
  db.exec(`ALTER TABLE products ADD COLUMN brand TEXT;`);
  console.log('✅ Columna "brand" agregada a la tabla products.');
} catch (_) {
  // La columna ya existe – ignorar
}

// ─── Catálogo de productos ────────────────────────────────────────────────────
const PRODUCTS = [
  // ── Smartphones ──────────────────────────────────────────────────────────────
  {
    id: 'p1',
    brand: 'Apple',
    name: 'iPhone 15 Pro Max',
    description: 'Apple iPhone 15 Pro Max with 256GB storage, titanium design, A17 Pro chip, ProRAW camera system, USB-C, and 120Hz ProMotion display.',
    price: 1199,
    inventory: 15,
    image: 'https://images.unsplash.com/photo-1696446702183-cbd757b4f537?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p2',
    brand: 'Samsung',
    name: 'Samsung Galaxy S24 Ultra',
    description: 'Samsung Galaxy S24 Ultra with built-in S Pen, 200MP camera, Snapdragon 8 Gen 3, 5000mAh battery, and titanium frame.',
    price: 1099,
    inventory: 12,
    image: 'https://images.unsplash.com/photo-1706978509427-cf2228c6c8d4?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p3',
    brand: 'Google',
    name: 'Google Pixel 8 Pro',
    description: 'Google Pixel 8 Pro with Tensor G3 chip, 50MP camera array, 7 years of updates, and Google AI features.',
    price: 999,
    inventory: 20,
    image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p4',
    brand: 'Xiaomi',
    name: 'Xiaomi 14 Ultra',
    description: 'Xiaomi 14 Ultra with Leica-tuned camera, Snapdragon 8 Gen 3, 90W wireless charging, and 6.73" LTPO AMOLED display.',
    price: 899,
    inventory: 18,
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p5',
    brand: 'OnePlus',
    name: 'OnePlus 12',
    description: 'OnePlus 12 with Hasselblad camera, Snapdragon 8 Gen 3, 100W SUPERVOOC charging, and 120Hz ProXDR display.',
    price: 799,
    inventory: 14,
    image: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Laptops ──────────────────────────────────────────────────────────────────
  {
    id: 'p6',
    brand: 'Apple',
    name: 'MacBook Pro 14" M3 Pro',
    description: 'Apple MacBook Pro 14-inch with M3 Pro chip, 18GB unified memory, 512GB SSD, Liquid Retina XDR display, and 22-hour battery life.',
    price: 1999,
    inventory: 8,
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p7',
    brand: 'Dell',
    name: 'Dell XPS 15 OLED',
    description: 'Dell XPS 15 with Intel Core i9, 32GB DDR5 RAM, 1TB NVMe SSD, OLED touch display, and NVIDIA RTX 4060 graphics.',
    price: 1799,
    inventory: 6,
    image: 'https://images.unsplash.com/photo-1593642634367-d91a135587b5?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p8',
    brand: 'Lenovo',
    name: 'Lenovo ThinkPad X1 Carbon Gen 11',
    description: 'Lenovo ThinkPad X1 Carbon with Intel Core i7 vPro, 16GB RAM, 512GB SSD, MIL-SPEC tested, and 15-hour battery.',
    price: 1549,
    inventory: 10,
    image: 'https://images.unsplash.com/photo-1588702547919-26089e690ecc?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p9',
    brand: 'ASUS',
    name: 'ASUS ROG Zephyrus G14',
    description: 'ASUS ROG Zephyrus G14 gaming laptop with AMD Ryzen 9, NVIDIA RTX 4070, 16GB RAM, 1TB SSD, and 165Hz QHD display.',
    price: 1399,
    inventory: 9,
    image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p10',
    brand: 'Microsoft',
    name: 'Microsoft Surface Laptop 5',
    description: 'Microsoft Surface Laptop 5 with Intel Core i7, 16GB RAM, 512GB SSD, 13.5" PixelSense Touch display, and Windows 11.',
    price: 1299,
    inventory: 11,
    image: 'https://images.unsplash.com/photo-1484788984921-03950022c9ef?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Headphones & Audio ───────────────────────────────────────────────────────
  {
    id: 'p11',
    brand: 'Sony',
    name: 'Sony WH-1000XM5',
    description: 'Sony WH-1000XM5 wireless headphones with industry-leading noise cancellation, 30-hour battery, multipoint connection, and Hi-Res Audio.',
    price: 349,
    inventory: 25,
    image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p12',
    brand: 'Apple',
    name: 'Apple AirPods Pro 2',
    description: 'Apple AirPods Pro 2nd generation with H2 chip, Active Noise Cancellation, Adaptive Transparency, Personalized Spatial Audio, and USB-C.',
    price: 249,
    inventory: 30,
    image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p13',
    brand: 'Bose',
    name: 'Bose QuietComfort Ultra',
    description: 'Bose QuietComfort Ultra headphones with world-class noise cancellation, Immersive Audio mode, CustomTune technology.',
    price: 379,
    inventory: 16,
    image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p14',
    brand: 'Sennheiser',
    name: 'Sennheiser Momentum 4 Wireless',
    description: 'Sennheiser Momentum 4 Wireless with 60-hour battery, adaptive ANC, crystal-clear calls, and premium sound.',
    price: 279,
    inventory: 20,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p15',
    brand: 'JBL',
    name: 'JBL Charge 5 Bluetooth Speaker',
    description: 'JBL Charge 5 waterproof portable speaker with 20-hour battery, PartyBoost, built-in power bank, and IP67 rating.',
    price: 179,
    inventory: 35,
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Smartwatches ─────────────────────────────────────────────────────────────
  {
    id: 'p16',
    brand: 'Apple',
    name: 'Apple Watch Series 9',
    description: 'Apple Watch Series 9 with S9 chip, double tap gesture, Precision Finding for iPhone, always-on Retina display, and health sensors.',
    price: 399,
    inventory: 22,
    image: 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p17',
    brand: 'Samsung',
    name: 'Samsung Galaxy Watch 6 Classic',
    description: 'Samsung Galaxy Watch 6 Classic with rotating bezel, Advanced Sleep Coaching, Body Composition analysis, Sapphire Crystal glass.',
    price: 349,
    inventory: 18,
    image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p18',
    brand: 'Garmin',
    name: 'Garmin Fenix 7 Pro Solar',
    description: 'Garmin Fenix 7 Pro Solar GPS multisport watch with solar charging, flashlight, advanced training metrics, and 37-day battery.',
    price: 699,
    inventory: 10,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p19',
    brand: 'Fitbit',
    name: 'Fitbit Sense 2',
    description: 'Fitbit Sense 2 advanced health smartwatch with built-in GPS, EDA sensor for stress management, ECG app, and 6-day battery.',
    price: 249,
    inventory: 24,
    image: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Tablets ──────────────────────────────────────────────────────────────────
  {
    id: 'p20',
    brand: 'Apple',
    name: 'iPad Pro 12.9" M2',
    description: 'Apple iPad Pro 12.9-inch with M2 chip, Liquid Retina XDR display, Wi-Fi 6E, Apple Pencil hover, and ProRes video recording.',
    price: 1099,
    inventory: 12,
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p21',
    brand: 'Samsung',
    name: 'Samsung Galaxy Tab S9 Ultra',
    description: 'Samsung Galaxy Tab S9 Ultra with 14.6" Dynamic AMOLED 2X display, Snapdragon 8 Gen 2, S Pen included, and DeX mode.',
    price: 999,
    inventory: 15,
    image: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Cameras ──────────────────────────────────────────────────────────────────
  {
    id: 'p22',
    brand: 'Sony',
    name: 'Sony ZV-E10 Mirrorless Camera',
    description: 'Sony ZV-E10 mirrorless camera for content creators with 24.2MP, 4K video, vlog-optimized autofocus, and interchangeable lens.',
    price: 748,
    inventory: 8,
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p23',
    brand: 'Canon',
    name: 'Canon EOS R50',
    description: 'Canon EOS R50 mirrorless camera with 24.2MP APS-C sensor, subject tracking, 4K video, Dual Pixel CMOS AF II.',
    price: 679,
    inventory: 10,
    image: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p24',
    brand: 'GoPro',
    name: 'GoPro HERO12 Black',
    description: 'GoPro HERO12 Black with 5.3K60 video, HyperSmooth 6.0, Max Lens Mod 2.0 compatible, waterproof to 33ft.',
    price: 399,
    inventory: 20,
    image: 'https://images.unsplash.com/photo-1525973132219-8e7de73da6d1?q=80&w=2000&auto=format&fit=crop',
  },

  // ── TVs & Displays ───────────────────────────────────────────────────────────
  {
    id: 'p25',
    brand: 'LG',
    name: 'LG C3 OLED 65"',
    description: 'LG C3 65-inch OLED evo TV with α9 AI Processor Gen6, 4K 120Hz, VRR, Dolby Vision & Atmos, and webOS 23.',
    price: 1696,
    inventory: 5,
    image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p26',
    brand: 'Samsung',
    name: 'Samsung Neo QLED 4K 55"',
    description: 'Samsung 55" QN85C Neo QLED 4K TV with Neural Quantum Processor 4K, Mini LED, Anti-Reflection, and Motion Xcelerator Turbo+.',
    price: 1199,
    inventory: 7,
    image: 'https://images.unsplash.com/photo-1571415060716-baff5f717c37?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p27',
    brand: 'Dell',
    name: 'Dell UltraSharp 27" 4K Monitor',
    description: 'Dell UltraSharp U2723QE 27-inch 4K USB-C monitor with IPS Black panel, 98% DCI-P3, ComfortView Plus, and daisy chain.',
    price: 649,
    inventory: 13,
    image: 'https://images.unsplash.com/photo-1527443224154-c4a573d5a09d?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Gaming ───────────────────────────────────────────────────────────────────
  {
    id: 'p28',
    brand: 'Sony',
    name: 'PlayStation 5 Slim',
    description: 'Sony PlayStation 5 Slim console with 1TB SSD, 4K gaming, Ray Tracing, 120fps support, and DualSense controller.',
    price: 449,
    inventory: 8,
    image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p29',
    brand: 'Microsoft',
    name: 'Xbox Series X',
    description: 'Microsoft Xbox Series X with 12 teraflops GPU, 1TB Custom NVMe SSD, Quick Resume, 4K 120fps, and Smart Delivery.',
    price: 499,
    inventory: 9,
    image: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p30',
    brand: 'Nintendo',
    name: 'Nintendo Switch OLED',
    description: 'Nintendo Switch OLED model with 7-inch OLED screen, 64GB storage, enhanced audio, LAN port dock, and detachable Joy-Cons.',
    price: 349,
    inventory: 18,
    image: 'https://images.unsplash.com/photo-1617096200347-cb04ae810b1d?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p31',
    brand: 'Razer',
    name: 'Razer DeathAdder V3 Pro',
    description: 'Razer DeathAdder V3 Pro wireless gaming mouse with 30K DPI optical sensor, 90-hour battery, Focus Pro HyperSpeed, and ultra-light design.',
    price: 149,
    inventory: 30,
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p32',
    brand: 'Logitech',
    name: 'Logitech G Pro X Superlight 2',
    description: 'Logitech G Pro X Superlight 2 wireless gaming mouse, HERO 2 sensor, 95+ hours battery, only 60g weight.',
    price: 159,
    inventory: 25,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p33',
    brand: 'SteelSeries',
    name: 'SteelSeries Apex Pro TKL',
    description: 'SteelSeries Apex Pro TKL mechanical gaming keyboard with OmniPoint 2.0 adjustable switches, OLED display, and magnetic wrist rest.',
    price: 229,
    inventory: 20,
    image: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Smart Home ───────────────────────────────────────────────────────────────
  {
    id: 'p34',
    brand: 'Amazon',
    name: 'Amazon Echo Show 10',
    description: 'Amazon Echo Show 10 with 10.1" HD screen that automatically moves to face you, built-in Zigbee hub, and Alexa.',
    price: 249,
    inventory: 22,
    image: 'https://images.unsplash.com/photo-1512446816042-444d641267d4?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p35',
    brand: 'Google',
    name: 'Google Nest Hub Max',
    description: 'Google Nest Hub Max with 10" HD display, built-in camera for video calls, Face Match, Chromecast built-in.',
    price: 229,
    inventory: 17,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p36',
    brand: 'Philips Hue',
    name: 'Philips Hue White & Color Ambiance Starter Kit',
    description: 'Philips Hue starter kit with 4 A19 smart bulbs, Hue Bridge, and app control. 16 million colors, voice control compatible.',
    price: 199,
    inventory: 28,
    image: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p37',
    brand: 'iRobot',
    name: 'iRobot Roomba j7+',
    description: 'iRobot Roomba j7+ robot vacuum with PrecisionVision Navigation, auto-emptying Clean Base, obstacle avoidance, and imprint Smart Mapping.',
    price: 599,
    inventory: 10,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p38',
    brand: 'Nest',
    name: 'Google Nest Learning Thermostat',
    description: 'Google Nest Learning Thermostat 3rd Gen, programs itself, Energy Star certified, remote control via app, works with Alexa.',
    price: 249,
    inventory: 19,
    image: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Accessories & Peripherals ────────────────────────────────────────────────
  {
    id: 'p39',
    brand: 'Anker',
    name: 'Anker 737 Power Bank 24000mAh',
    description: 'Anker 737 power bank with 140W output, 24000mAh capacity, charges MacBook Pro in 1.8 hours, and smart display.',
    price: 99,
    inventory: 40,
    image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p40',
    brand: 'Apple',
    name: 'Apple MagSafe Charger 15W',
    description: 'Apple MagSafe Charger with 15W fast wireless charging for iPhone 12 and later. Perfect magnetic alignment.',
    price: 39,
    inventory: 50,
    image: 'https://images.unsplash.com/photo-1618898909019-010e4e234c55?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p41',
    brand: 'Logitech',
    name: 'Logitech MX Master 3S',
    description: 'Logitech MX Master 3S wireless mouse with 8K DPI, MagSpeed wheel, quiet clicks, USB-C, and Logi Bolt receiver.',
    price: 99,
    inventory: 35,
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p42',
    brand: 'Keychron',
    name: 'Keychron Q3 Pro Wireless Mechanical Keyboard',
    description: 'Keychron Q3 Pro TKL wireless mechanical keyboard with QMK/VIA support, aluminum CNC body, hot-swappable switches.',
    price: 199,
    inventory: 15,
    image: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p43',
    brand: 'CalDigit',
    name: 'CalDigit TS4 Thunderbolt 4 Dock',
    description: 'CalDigit TS4 Thunderbolt 4 dock with 18 ports, 98W charging, triple 4K display support, and 40Gbps transfer.',
    price: 329,
    inventory: 12,
    image: 'https://images.unsplash.com/photo-1588702547919-26089e690ecc?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Drones ───────────────────────────────────────────────────────────────────
  {
    id: 'p44',
    brand: 'DJI',
    name: 'DJI Mini 4 Pro',
    description: 'DJI Mini 4 Pro drone with 4K/60fps HDR video, omnidirectional obstacle sensing, 34-min flight time, and under 249g.',
    price: 759,
    inventory: 7,
    image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p45',
    brand: 'DJI',
    name: 'DJI Osmo Pocket 3',
    description: 'DJI Osmo Pocket 3 creator combo with 1-inch CMOS sensor, 4K/120fps, 3-axis stabilization, and 2-hour battery.',
    price: 519,
    inventory: 14,
    image: 'https://images.unsplash.com/photo-1525973132219-8e7de73da6d1?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Wearables & Fitness ──────────────────────────────────────────────────────
  {
    id: 'p46',
    brand: 'Oura',
    name: 'Oura Ring Gen3 Heritage',
    description: 'Oura Ring Gen3 Heritage smart ring tracks sleep, activity, heart rate, SpO2, skin temperature, and menstrual cycle.',
    price: 299,
    inventory: 20,
    image: 'https://images.unsplash.com/photo-1613482184972-f9a88620f3f5?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p47',
    brand: 'Whoop',
    name: 'WHOOP 4.0 Band',
    description: 'WHOOP 4.0 fitness tracker with continuous heart rate, sleep tracking, recovery scores, and strain coaching. No screen, pure data.',
    price: 239,
    inventory: 16,
    image: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Storage ──────────────────────────────────────────────────────────────────
  {
    id: 'p48',
    brand: 'Samsung',
    name: 'Samsung T9 4TB Portable SSD',
    description: 'Samsung T9 4TB portable SSD with USB 3.2 Gen 2x2 (20Gbps), IP65 rating, read speeds up to 2,000 MB/s.',
    price: 279,
    inventory: 22,
    image: 'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p49',
    brand: 'SanDisk',
    name: 'SanDisk Extreme Pro 2TB USB-C SSD',
    description: 'SanDisk Extreme Pro 2TB external SSD with 2000MB/s read, IP55 resistance, and 256-bit AES encryption.',
    price: 199,
    inventory: 28,
    image: 'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Networking ───────────────────────────────────────────────────────────────
  {
    id: 'p50',
    brand: 'Eero',
    name: 'Amazon eero Pro 6E Mesh Router (3-Pack)',
    description: 'Amazon eero Pro 6E tri-band mesh Wi-Fi system covers up to 6000 sq ft, supports Wi-Fi 6E, and includes Gigabit ports.',
    price: 449,
    inventory: 13,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p51',
    brand: 'TP-Link',
    name: 'TP-Link Archer AXE300 Wi-Fi 6E Router',
    description: 'TP-Link Archer AXE300 quad-band Wi-Fi 6E router, 19200Mbps, 6GHz band, 12 antennas, and HomeShield security.',
    price: 349,
    inventory: 17,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=2000&auto=format&fit=crop',
  },

  // ── E-Readers ────────────────────────────────────────────────────────────────
  {
    id: 'p52',
    brand: 'Amazon',
    name: 'Kindle Paperwhite 11th Gen',
    description: 'Amazon Kindle Paperwhite with 6.8" display, adjustable warm light, waterproof IPX8, 32GB, and 10-week battery.',
    price: 139,
    inventory: 40,
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p53',
    brand: 'Kobo',
    name: 'Kobo Elipsa 2E',
    description: 'Kobo Elipsa 2E e-reader with 10.3" E Ink Carta 1200 display, stylus, ComfortLight Pro, and OverDrive library support.',
    price: 399,
    inventory: 14,
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=2000&auto=format&fit=crop',
  },

  // ── Earbuds ──────────────────────────────────────────────────────────────────
  {
    id: 'p54',
    brand: 'Samsung',
    name: 'Samsung Galaxy Buds3 Pro',
    description: 'Samsung Galaxy Buds3 Pro with blade-style design, ANC, 360 Audio, 6-hour listening + 24-hour with case, and IP57.',
    price: 249,
    inventory: 26,
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=2000&auto=format&fit=crop',
  },
  {
    id: 'p55',
    brand: 'Nothing',
    name: 'Nothing Ear (2)',
    description: 'Nothing Ear (2) TWS earbuds with dual dynamic drivers, Hi-Res Audio, Advanced ANC, 36-hour total battery life.',
    price: 149,
    inventory: 22,
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=2000&auto=format&fit=crop',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function upsertProduct(product) {
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(product.id);
  if (existing) {
    // Update inventory (refill)
    db.prepare('UPDATE products SET inventory = ?, name = ?, description = ?, price = ?, image = ?, brand = ? WHERE id = ?')
      .run(product.inventory, product.name, product.description, product.price, product.image, product.brand || null, product.id);
    return 'updated';
  } else {
    db.prepare('INSERT INTO products (id, name, description, price, inventory, image, brand) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(product.id, product.name, product.description, product.price, product.inventory, product.image, product.brand || null);
    return 'inserted';
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log('\n🛍️  E-Commerce Product Seeder');
  console.log('─'.repeat(50));

  if (MODE_RESET) {
    console.log('⚠️  --reset flag detectado. Eliminando todos los productos...');
    db.prepare('DELETE FROM products').run();
    console.log('✅ Tabla products limpiada.');
  }

  let inserted = 0;
  let updated  = 0;

  const insertMany = db.transaction(() => {
    for (const product of PRODUCTS) {
      if (MODE_REFILL) {
        // Solo actualiza el inventario, no inserta nuevos
        const exists = db.prepare('SELECT id FROM products WHERE id = ?').get(product.id);
        if (exists) {
          db.prepare('UPDATE products SET inventory = ? WHERE id = ?').run(product.inventory, product.id);
          updated++;
          console.log(`  🔄 Refill: [${product.id}] ${product.name} → ${product.inventory} units`);
        } else {
          console.log(`  ⏭️  Omitido (no existe en DB): [${product.id}] ${product.name}`);
        }
      } else {
        const result = upsertProduct(product);
        if (result === 'inserted') {
          inserted++;
          console.log(`  ✅ Nuevo:    [${product.id}] ${product.brand ? product.brand + ' - ' : ''}${product.name} ($${product.price})`);
        } else {
          updated++;
          console.log(`  🔄 Actualizado: [${product.id}] ${product.name}`);
        }
      }
    }
  });

  insertMany();

  console.log('\n─'.repeat(50));
  console.log(`📦 Total productos en catálogo: ${PRODUCTS.length}`);
  if (MODE_REFILL) {
    console.log(`🔄 Inventarios actualizados: ${updated}`);
  } else {
    console.log(`✅ Insertados: ${inserted}  |  🔄 Actualizados: ${updated}`);
  }

  // Verificación final
  const countResult = db.prepare('SELECT COUNT(*) as count FROM products').get();
  console.log(`🗄️  Total en base de datos ahora: ${countResult.count} productos`);
  console.log('─'.repeat(50));
  console.log('¡Listo! 🚀\n');

  db.close();
}

main();
