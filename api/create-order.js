const { getPool } = require("./_db");

const menuPrices = {
    "Hojicha Latte": 150,
    "Spanish Latte": 140,
    Matcha: 160,
    "Castella Cake": 120,
    Genmaicha: 130,
    "Yuzu Honey Tea": 135,
    Dorayaki: 110,
    Onigiri: 95
};
const paymentMethods = ["Cash on Table", "GCash", "Debit / Credit Card"];

module.exports = async function handler(request, response) {
    if (request.method !== "POST") {
        response.status(405).json({ error: "Only POST requests are allowed." });
        return;
    }

    const body = request.body || {};
    const tableNumber = String(body.tableNumber || "").trim();
    const paymentMethod = String(body.paymentMethod || "").trim();
    const receiptEmail = String(body.receiptEmail || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!tableNumber || !paymentMethods.includes(paymentMethod)) {
        response.status(400).json({ error: "Table number and a valid payment method are required." });
        return;
    }
    if (receiptEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail)) {
        response.status(400).json({ error: "Please provide a valid email address." });
        return;
    }
    if (!items.length) {
        response.status(400).json({ error: "Add at least one item before confirming." });
        return;
    }

    const validatedItems = [];
    let total = 0;
    for (const item of items) {
        const name = String(item.name || "").trim();
        const quantity = Number.parseInt(item.quantity, 10);
        if (!Object.prototype.hasOwnProperty.call(menuPrices, name) || !Number.isInteger(quantity) || quantity < 1) {
            response.status(400).json({ error: "That menu item or quantity is not valid." });
            return;
        }
        const price = menuPrices[name];
        validatedItems.push({ name, price, quantity });
        total += price * quantity;
    }

    let connection;
    try {
        const pool = getPool();
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [orderResult] = await connection.execute(
            `INSERT INTO orders (table_number, payment_method, receipt_email, total)
             VALUES (?, ?, ?, ?)`,
            [tableNumber, paymentMethod, receiptEmail || null, total]
        );
        for (const item of validatedItems) {
            await connection.execute(
                `INSERT INTO order_items (order_id, item_name, price, quantity)
                 VALUES (?, ?, ?, ?)`,
                [orderResult.insertId, item.name, item.price, item.quantity]
            );
        }
        await connection.commit();
        response.status(200).json({ success: true, orderId: orderResult.insertId, total });
    } catch (error) {
        if (connection) await connection.rollback();
        response.status(500).json({ error: "The order could not be saved." });
    } finally {
        if (connection) connection.release();
    }
};
