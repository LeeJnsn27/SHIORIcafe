const { getPool } = require("./_db");

function validTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

module.exports = async function handler(request, response) {
    const { date = "", startTime = "", endTime = "", seatName = "" } = request.query || {};

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validTime(startTime) || !validTime(endTime) || endTime <= startTime) {
        response.status(400).json({ error: "Choose a valid date and time range." });
        return;
    }

    try {
        const pool = getPool();
        const [occupiedRows] = await pool.execute(
            `SELECT seats.seat_name
             FROM reservations
             INNER JOIN seats ON seats.id = reservations.seat_id
             WHERE reservation_date = ?
               AND reservation_start_time < ?
               AND reservation_end_time > ?`,
            [date, endTime, startTime]
        );
        const occupiedSeats = occupiedRows.map((row) => row.seat_name);
        const availability = { conflict: false, nextAvailableStart: null, nextAvailableEnd: null };

        if (seatName) {
            const [reservations] = await pool.execute(
                `SELECT reservation_start_time, reservation_end_time
                 FROM reservations
                 WHERE seat_id = (SELECT id FROM seats WHERE seat_name = ? LIMIT 1)
                   AND reservation_date = ?
                 ORDER BY reservation_start_time`,
                [seatName, date]
            );
            availability.conflict = occupiedSeats.includes(seatName);
            if (availability.conflict) {
                const duration = toSeconds(endTime) - toSeconds(startTime);
                let candidate = toSeconds(endTime);
                for (const reservation of reservations) {
                    const reservedStart = toSeconds(String(reservation.reservation_start_time).slice(0, 5));
                    const reservedEnd = toSeconds(String(reservation.reservation_end_time).slice(0, 5));
                    if (candidate + duration <= reservedStart) break;
                    if (candidate < reservedEnd) candidate = reservedEnd;
                }
                availability.nextAvailableStart = fromSeconds(candidate);
                availability.nextAvailableEnd = fromSeconds(candidate + duration);
            }
        }

        response.status(200).json({ success: true, occupiedSeats, availability });
    } catch (error) {
        response.status(500).json({ error: "Seat availability could not be loaded." });
    }
};

function toSeconds(value) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 3600 + minutes * 60;
}

function fromSeconds(value) {
    const normalized = value % (24 * 3600);
    return `${String(Math.floor(normalized / 3600)).padStart(2, "0")}:${String(Math.floor((normalized % 3600) / 60)).padStart(2, "0")}`;
}
