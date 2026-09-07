const { getPool } = require("./_db");

function validDate(value) {
    const date = new Date(`${value}T00:00:00`);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime());
}

function validTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

module.exports = async function handler(request, response) {
    if (request.method !== "POST") {
        response.status(405).json({ error: "Only POST requests are allowed." });
        return;
    }

    const body = request.body || {};
    const guestName = String(body.guestName || "").trim();
    const guestEmail = String(body.guestEmail || "").trim();
    const seatName = String(body.seatName || "").trim();
    const reservationDate = String(body.reservationDate || "").trim();
    const startTime = String(body.reservationStartTime || "").trim();
    const endTime = String(body.reservationEndTime || "").trim();

    if (!guestName || !seatName || !reservationDate || !startTime || !endTime) {
        response.status(400).json({ error: "Name, seat, date, and time are required." });
        return;
    }

    if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
        response.status(400).json({ error: "Please provide a valid email address." });
        return;
    }

    if (!validDate(reservationDate) || reservationDate < new Date().toISOString().slice(0, 10)) {
        response.status(400).json({ error: "Please choose today or a future date." });
        return;
    }

    if (!validTime(startTime) || !validTime(endTime) || endTime <= startTime) {
        response.status(400).json({ error: "Please provide a valid time range." });
        return;
    }

    try {
        const pool = getPool();
        const [seatRows] = await pool.execute(
            "SELECT id FROM seats WHERE seat_name = ? AND is_active = TRUE",
            [seatName]
        );

        if (!seatRows.length) {
            response.status(400).json({ error: "That seat is not available." });
            return;
        }

        const seatId = seatRows[0].id;
        const [overlaps] = await pool.execute(
            `SELECT id FROM reservations
             WHERE seat_id = ? AND reservation_date = ?
               AND reservation_start_time < ? AND reservation_end_time > ?
             LIMIT 1`,
            [seatId, reservationDate, endTime, startTime]
        );

        if (overlaps.length) {
            response.status(409).json({ error: "That seat is already reserved during part of this time range." });
            return;
        }

        const [result] = await pool.execute(
            `INSERT INTO reservations
             (guest_name, guest_email, seat_id, reservation_date, reservation_start_time, reservation_end_time)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [guestName, guestEmail || null, seatId, reservationDate, startTime, endTime]
        );

        response.status(200).json({ success: true, reservationId: result.insertId });
    } catch (error) {
        response.status(500).json({ error: "The reservation could not be saved." });
    }
};
