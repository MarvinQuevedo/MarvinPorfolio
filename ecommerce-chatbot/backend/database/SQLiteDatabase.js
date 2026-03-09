const IDatabase = require('./IDatabase');
const Database = require('better-sqlite3');
const path = require('path');

class SQLiteDatabase extends IDatabase {
    constructor() {
        super();
        const dbPath = path.resolve(__dirname, '../../data.db');
        this.db = new Database(dbPath);
        this.init();
    }

    init() {
        // Create tables if they don't exist
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                inventory INTEGER NOT NULL,
                image TEXT
            );

            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                product_id TEXT NOT NULL,
                product_name TEXT,
                client_name TEXT,
                client_address TEXT,
                client_phone TEXT,
                status TEXT,
                amount REAL,
                created_at INTEGER,
                FOREIGN KEY (product_id) REFERENCES products(id)
            );

            CREATE TABLE IF NOT EXISTS order_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                status TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id)
            );
        `);
    }

    // Product Methods
    async getAllProducts() {
        const stmt = this.db.prepare('SELECT * FROM products');
        return stmt.all();
    }

    async getProductById(id) {
        const stmt = this.db.prepare('SELECT * FROM products WHERE id = ?');
        return stmt.get(id);
    }

    async searchProducts(query = '', limit = 10, offset = 0) {
        if (!query || query.trim() === '') {
            // No query: return paginated list
            const stmt = this.db.prepare('SELECT * FROM products LIMIT ? OFFSET ?');
            return stmt.all(limit, offset);
        }
        // Split query into individual keywords so multi-word searches also work
        const keywords = query.trim().split(/\s+/);
        // Build: (name LIKE ? OR description LIKE ?) AND (name LIKE ? OR description LIKE ?) ...
        const conditions = keywords.map(() => '(name LIKE ? OR description LIKE ?)').join(' AND ');
        const params = keywords.flatMap(kw => [`%${kw}%`, `%${kw}%`]);
        const stmt = this.db.prepare(
            `SELECT * FROM products WHERE ${conditions} LIMIT ? OFFSET ?`
        );
        return stmt.all(...params, limit, offset);
    }

    async getProductCount(query = '') {
        if (!query || query.trim() === '') {
            const stmt = this.db.prepare('SELECT COUNT(*) as count FROM products');
            return stmt.get().count;
        }
        const keywords = query.trim().split(/\s+/);
        const conditions = keywords.map(() => '(name LIKE ? OR description LIKE ?)').join(' AND ');
        const params = keywords.flatMap(kw => [`%${kw}%`, `%${kw}%`]);
        const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM products WHERE ${conditions}`);
        return stmt.get(...params).count;
    }

    async updateProductInventory(id, delta) {
        const stmt = this.db.prepare('UPDATE products SET inventory = inventory + ? WHERE id = ?');
        return stmt.run(delta, id);
    }

    // Order Methods
    async createOrder(orderData) {
        const { trackId, productId, productName, name, address, phone, status, amount, createdAt, history } = orderData;
        
        const insertOrder = this.db.prepare(`
            INSERT INTO orders (id, product_id, product_name, client_name, client_address, client_phone, status, amount, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertHistory = this.db.prepare(`
            INSERT INTO order_history (order_id, status, timestamp)
            VALUES (?, ?, ?)
        `);

        const transaction = this.db.transaction((data) => {
            insertOrder.run(data.trackId, data.productId, data.productName, data.name, data.address, data.phone, data.status, data.amount, data.createdAt);
            for (const entry of data.history) {
                insertHistory.run(data.trackId, entry.status, entry.timestamp);
            }
        });

        transaction(orderData);
        return { success: true };
    }

    async getOrderById(id) {
        const orderStmt = this.db.prepare('SELECT * FROM orders WHERE id = ?');
        const order = orderStmt.get(id);
        
        if (!order) return null;

        const historyStmt = this.db.prepare('SELECT status, timestamp FROM order_history WHERE order_id = ? ORDER BY timestamp ASC');
        const history = historyStmt.all(id);

        // Map database fields to application fields
        return {
            trackId: order.id,
            productId: order.product_id,
            productName: order.product_name,
            name: order.client_name,
            address: order.client_address,
            phone: order.client_phone,
            status: order.status,
            amount: order.amount,
            createdAt: order.created_at,
            history: history
        };
    }

    async getAllOrders() {
        const stmt = this.db.prepare('SELECT * FROM orders');
        const orders = stmt.all();
        
        // This could be slow if there are many orders, but for a chatbot it's fine for now
        // Usually admin dashboard would use pagination
        return orders.map(order => {
            const historyStmt = this.db.prepare('SELECT status, timestamp FROM order_history WHERE order_id = ? ORDER BY timestamp ASC');
            const history = historyStmt.all(order.id);
            return {
                trackId: order.id,
                productId: order.product_id,
                productName: order.product_name,
                name: order.client_name,
                address: order.client_address,
                phone: order.client_phone,
                status: order.status,
                amount: order.amount,
                createdAt: order.created_at,
                history: history
            };
        });
    }

    async updateOrderStatus(id, status, historyEntry) {
        const updateOrder = this.db.prepare('UPDATE orders SET status = ? WHERE id = ?');
        const insertHistory = this.db.prepare('INSERT INTO order_history (order_id, status, timestamp) VALUES (?, ?, ?)');

        const transaction = this.db.transaction((orderId, newStatus, entry) => {
            updateOrder.run(newStatus, orderId);
            insertHistory.run(orderId, entry.status, entry.timestamp);
        });

        transaction(id, status, historyEntry);
        return { success: true };
    }
}

module.exports = SQLiteDatabase;
