USE shiori_cafe;

ALTER TABLE reservations
    ADD COLUMN reservation_start_time TIME NULL AFTER reservation_date,
    ADD COLUMN reservation_end_time TIME NULL AFTER reservation_start_time;

UPDATE reservations
SET reservation_start_time = reservation_time,
    reservation_end_time = ADDTIME(reservation_time, '01:00:00')
WHERE reservation_start_time IS NULL OR reservation_end_time IS NULL;

ALTER TABLE reservations
    DROP INDEX unique_booking,
    DROP COLUMN reservation_time,
    MODIFY reservation_start_time TIME NOT NULL,
    MODIFY reservation_end_time TIME NOT NULL,
    ADD UNIQUE KEY unique_booking (seat_id, reservation_date, reservation_start_time);