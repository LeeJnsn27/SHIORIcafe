const mysql = require("mysql2/promise");

let pool;

function getPool() {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL is not configured.");
        }

        const databaseUrl = new URL(process.env.DATABASE_URL);
        pool = mysql.createPool({
            host: databaseUrl.hostname,
            port: Number(databaseUrl.port || 3306),
            user: decodeURIComponent(databaseUrl.username),
            password: decodeURIComponent(databaseUrl.password),
            database: databaseUrl.pathname.replace(/^\//, ""),
            waitForConnections: true,
            connectionLimit: 5,
            ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: true }
        });
    }

    return pool;
}

module.exports = { getPool };
