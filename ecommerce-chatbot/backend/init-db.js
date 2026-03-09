const db = require('./database');
const initialProducts = require('./products');

async function init() {
    console.log("Initializing database...");
    
    // Check if products already exist
    const products = await db.getAllProducts();
    
    if (products.length === 0) {
        console.log("Seeding products...");
        for (const product of initialProducts) {
            // We use the raw database connection or a specific method if we had one
            // Since we're in the init script, we can just use the db's internal connection if exposed or add a method.
            // Let's add a seed method or just use the existing one if we can.
            // SQLiteDatabase.db is available.
            db.db.prepare(`
                INSERT INTO products (id, name, description, price, inventory, image)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(product.id, product.name, product.description, product.price, product.inventory, product.image);
        }
        console.log("Seeding completed.");
    } else {
        console.log("Database already has products.");
    }
}

init().catch(console.error);
