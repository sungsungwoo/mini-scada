-- Boiler-01 and Dryer-01 were both seeded as 127.0.0.1:5020 slave 1.
-- Admin API enforces unique (ip_address, port, slave_id) — adjust Dryer to a free slave id.
UPDATE devices
SET slave_id = 7,
    updated_at = now()
WHERE id = 'b0000001-0001-4001-8001-000000000004'
  AND ip_address = '127.0.0.1'
  AND port = 5020
  AND slave_id = 1;
