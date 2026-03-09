# Database Implementation Plan

A flexible database architecture has been implemented for the e-commerce chatbot, allowing for the use of different database engines (SQLite by default) to persist products, orders, and addresses.

## File Structure

- `backend/database/IDatabase.js`: Abstract base class defining the database interface.
- `backend/database/SQLiteDatabase.js`: Concrete implementation for SQLite using `better-sqlite3`.
- `backend/database/index.js`: Factory that exports the configured database instance.
- `backend/init-db.js`: Script to initialize and seed the database with initial products.
- `backend/server.js`: Refactored to use the database instead of in-memory objects.

## Database Schema (SQLite)

### `products` Table
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | Unique product identifier |
| `name` | TEXT | Product name |
| `description`| TEXT | Detailed description |
| `price` | REAL | Unit price |
| `inventory` | INTEGER | Stock quantity |
| `image` | TEXT | Image URL |

### `orders` Table
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | Tracking code (TRK-XXXX) |
| `product_id` | TEXT (FK) | Reference to the product |
| `product_name`| TEXT | Product name at the time of purchase |
| `client_name` | TEXT | Client's name |
| `client_address`| TEXT | Shipping address |
| `client_phone` | TEXT | Contact phone |
| `status` | TEXT | Current order status |
| `amount` | REAL | Order total |
| `created_at` | INTEGER | Creation timestamp |

### `order_history` Table
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER (PK)| Autoincrement |
| `order_id` | TEXT (FK) | Reference to the order |
| `status` | TEXT | Status at that point in time |
| `timestamp` | INTEGER | When the change occurred |

## How to use other engines
To add a new engine (e.g., MongoDB, PostgreSQL):
1. Create a new class in `backend/database/` that inherits from `IDatabase.js`.
2. Implement all asynchronous methods.
3. Update `backend/database/index.js` to include the new provider based on an environment variable `DB_PROVIDER`.

## Address Persistence
Addresses are currently stored within the `orders` table as `client_address`. This ensures the order maintains the original shipping address even if the client changes their default address in the future (if a user system were implemented).
