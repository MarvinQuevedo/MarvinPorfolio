/**
 * Interface for Database adaptors.
 * All methods should be implemented by specific database providers (SQLite, PostgreSQL, etc.)
 */
class IDatabase {
    // Product Methods
    async getAllProducts() { throw new Error('Method not implemented'); }
    async getProductById(id) { throw new Error('Method not implemented'); }
    async searchProducts(query, limit, offset) { throw new Error('Method not implemented'); }
    async getProductCount(query) { throw new Error('Method not implemented'); }
    async updateProductInventory(id, delta) { throw new Error('Method not implemented'); }

    // Order Methods
    async createOrder(orderData) { throw new Error('Method not implemented'); }
    async getOrderById(id) { throw new Error('Method not implemented'); }
    async getAllOrders() { throw new Error('Method not implemented'); }
    async updateOrderStatus(id, status, historyEntry) { throw new Error('Method not implemented'); }

    // Address/Client Methods (if needed separately, otherwise integrated in Order)
    // For now, they are integrated in OrderData
}

module.exports = IDatabase;
