const SQLiteDatabase = require('./SQLiteDatabase');

// In the future, we could check an environment variable to decide which database to use
// For now, default to SQLite as requested.
const provider = process.env.DB_PROVIDER || 'sqlite';

let database;

switch (provider) {
    case 'sqlite':
    default:
        database = new SQLiteDatabase();
        break;
}

module.exports = database;
