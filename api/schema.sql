CREATE DATABASE IF NOT EXISTS shiori_cafe
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE shiori_cafe;

CREATE TABLE IF NOT EXISTS seats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seat_name VARCHAR(100) NOT NULL UNIQUE,
    seat_type VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guest_name VARCHAR(100) NOT NULL,
    guest_email VARCHAR(255),
    seat_id INT NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_start_time TIME NOT NULL,
    reservation_end_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seat_id) REFERENCES seats(id),
    UNIQUE KEY unique_booking (seat_id, reservation_date, reservation_start_time)
);

INSERT IGNORE INTO seats (seat_name, seat_type) VALUES
    ('Tatami Desk 1', 'Tatami Desk'),
    ('Tatami Desk 2', 'Tatami Desk'),
    ('Tatami Desk 3', 'Tatami Desk'),
    ('Window Nook 1', 'Window Nook'),
    ('Window Nook 2', 'Window Nook'),
    ('Window Nook 3', 'Window Nook'),
    ('Group Study Table 1', 'Group Study Table'),
    ('Group Study Table 2', 'Group Study Table');

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_number VARCHAR(20) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    receipt_email VARCHAR(255),
    total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
