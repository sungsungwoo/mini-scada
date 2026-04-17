-- Demo seed: diverse device groups, protocol types, statuses, tags, latest values, open alarms, polling logs (dashboard QA)

-- ========== device_groups ==========
INSERT INTO device_groups (id, name, description, created_at, updated_at)
VALUES ('a0000001-0001-4001-8001-000000000001', 'Boiler Room', 'Steam / hot water', now(), now()),
       ('a0000001-0001-4001-8001-000000000002', 'Chiller Line', 'Cooling & HVAC', now(), now()),
       ('a0000001-0001-4001-8001-000000000003', 'Pump Station', 'Circulation pumps', now(), now()),
       ('a0000001-0001-4001-8001-000000000004', 'Storage Tank', 'Level / inventory', now(), now()),
       ('a0000001-0001-4001-8001-000000000005', 'Lab Simulator', 'Test bench & SIMULATOR', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ========== devices (name order for dashboard: Boiler, Chiller x2, Dryer, Line, Mixer, Pump, RTU, Tank) ==========
INSERT INTO devices (id, device_group_id, name, code, description, protocol_type, ip_address, port, slave_id,
                     polling_interval_sec, timeout_ms, retry_count, offline_threshold_sec,
                     status, last_seen_at, is_active, created_at, updated_at)
VALUES
    -- MODBUS_TCP + ONLINE + mixed alarms via tags
    ('b0000001-0001-4001-8001-000000000001', 'a0000001-0001-4001-8001-000000000001',
     'Boiler-01', 'BOILER-01', 'Steam pressure monitoring', 'MODBUS_TCP', '127.0.0.1', 5020, 1,
     5, 2000, 3, 15, 'ONLINE', now() - interval '12 seconds', true, now(), now()),

    ('b0000001-0001-4001-8001-000000000002', 'a0000001-0001-4001-8001-000000000002',
     'Chiller-01', 'CHILLER-01', 'Outlet temperature', 'MODBUS_TCP', '127.0.0.1', 5020, 2,
     5, 2000, 3, 15, 'ONLINE', now() - interval '8 seconds', true, now(), now()),

    ('b0000001-0001-4001-8001-000000000003', 'a0000001-0001-4001-8001-000000000002',
     'Chiller-02', 'CHILLER-02', 'Secondary loop', 'MODBUS_TCP', '127.0.0.1', 5020, 3,
     5, 2000, 3, 15, 'ONLINE', now() - interval '25 seconds', true, now(), now()),

    ('b0000001-0001-4001-8001-000000000004', 'a0000001-0001-4001-8001-000000000005',
     'Dryer-01', 'DRYER-01', 'Drying line outlet', 'SIMULATOR', '127.0.0.1', 5020, 1,
     10, 2000, 3, 30, 'ONLINE', now() - interval '5 seconds', true, now(), now()),

    ('b0000001-0001-4001-8001-000000000005', 'a0000001-0001-4001-8001-000000000004',
     'Line-Sensor-A', 'LINE-SENSOR-A', 'Conveyor ambient', 'SIMULATOR', NULL, NULL, NULL,
     10, 2000, 3, 20, 'ONLINE', now() - interval '18 seconds', true, now(), now()),

    ('b0000001-0001-4001-8001-000000000006', 'a0000001-0001-4001-8001-000000000005',
     'Mixer-01', 'MIXER-01', 'Batch mixer RPM', 'SIMULATOR', '127.0.0.1', 5020, 4,
     10, 2000, 3, 20, 'UNKNOWN', now() - interval '4 minutes', true, now(), now()),

    ('b0000001-0001-4001-8001-000000000007', 'a0000001-0001-4001-8001-000000000003',
     'Pump-A01', 'PUMP-A01', 'Main circulation pump', 'SIMULATOR', '127.0.0.1', 5020, 5,
     5, 2000, 3, 15, 'ONLINE', now() - interval '7 seconds', true, now(), now()),

    ('b0000001-0001-4001-8001-000000000008', 'a0000001-0001-4001-8001-000000000003',
     'Valve-RTU-01', 'VALVE-RTU-01', 'Serial Modbus RTU (demo)', 'MODBUS_RTU', NULL, NULL, 1,
     5, 2000, 3, 15, 'ONLINE', now() - interval '15 seconds', true, now(), now()),

    ('b0000001-0001-4001-8001-000000000009', 'a0000001-0001-4001-8001-000000000004',
     'Tank-01',      'TANK-01', 'Storage level', 'SIMULATOR', '127.0.0.1', 5020, 6,
     15, 2000, 3, 45, 'OFFLINE', now() - interval '2 hours', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ========== device_tags (unique device_id + code / device_id + fc + address) ==========
INSERT INTO device_tags (id, device_id, name, code, tag_type, function_code, address, quantity, data_type, byte_order, unit,
                         scale_factor, offset_value, warning_min, warning_max, critical_min, critical_max,
                         is_enabled, display_order, created_at, updated_at)
VALUES
    -- Boiler-01: steam pressure high -> WARNING on dashboard
    ('c0000001-0001-4001-8001-000000000001', 'b0000001-0001-4001-8001-000000000001', 'Steam Pressure', 'steam_bar', 'PRESSURE', 3, 100, 1, 'FLOAT32', 'BIG', 'bar',
     1.0, 0.0, NULL, 8.5, NULL, 9.5, true, 0, now(), now()),
    ('c0000001-0001-4001-8001-000000000002', 'b0000001-0001-4001-8001-000000000001', 'Feed Temp', 'feed_temp', 'TEMPERATURE', 3, 102, 1, 'FLOAT32', 'BIG', '°C',
     1.0, 0.0, NULL, 130.0, NULL, 145.0, true, 1, now(), now()),

    ('c0000001-0001-4001-8001-000000000003', 'b0000001-0001-4001-8001-000000000002', 'Outlet Temp', 'outlet_temp', 'TEMPERATURE', 3, 200, 1, 'FLOAT32', 'BIG', '°C',
     1.0, 0.0, NULL, 12.0, NULL, 18.0, true, 0, now(), now()),
    ('c0000001-0001-4001-8001-000000000004', 'b0000001-0001-4001-8001-000000000002', 'Return Pressure', 'ret_bar', 'PRESSURE', 3, 202, 1, 'FLOAT32', 'BIG', 'bar',
     1.0, 0.0, NULL, 3.5, NULL, 4.5, true, 1, now(), now()),

    ('c0000001-0001-4001-8001-000000000005', 'b0000001-0001-4001-8001-000000000003', 'Outlet Temp', 'outlet_temp', 'TEMPERATURE', 3, 300, 1, 'FLOAT32', 'BIG', '°C',
     1.0, 0.0, NULL, 11.0, NULL, 16.0, true, 0, now(), now()),

    ('c0000001-0001-4001-8001-000000000006', 'b0000001-0001-4001-8001-000000000004', 'Outlet Temp', 'outlet_temp', 'TEMPERATURE', 3, 400, 1, 'FLOAT32', 'BIG', '°C',
     1.0, 0.0, NULL, 65.0, NULL, 80.0, true, 0, now(), now()),
    ('c0000001-0001-4001-8001-000000000007', 'b0000001-0001-4001-8001-000000000004', 'Humidity', 'humidity', 'HUMIDITY', 3, 402, 1, 'FLOAT32', 'BIG', '%',
     1.0, 0.0, NULL, 75.0, NULL, 90.0, true, 1, now(), now()),

    ('c0000001-0001-4001-8001-000000000008', 'b0000001-0001-4001-8001-000000000005', 'Ambient', 'ambient_c', 'TEMPERATURE', 3, 500, 1, 'FLOAT32', 'BIG', '°C',
     1.0, 0.0, NULL, 35.0, NULL, 42.0, true, 0, now(), now()),

    ('c0000001-0001-4001-8001-000000000009', 'b0000001-0001-4001-8001-000000000006', 'RPM', 'rpm', 'RPM', 3, 600, 1, 'UINT16', 'BIG', 'rpm',
     1.0, 0.0, NULL, 2800.0, NULL, 3200.0, true, 0, now(), now()),
    ('c0000001-0001-4001-8001-000000000010', 'b0000001-0001-4001-8001-000000000006', 'Torque', 'torque', 'CUSTOM', 3, 601, 1, 'FLOAT32', 'BIG', 'Nm',
     1.0, 0.0, NULL, NULL, NULL, NULL, true, 1, now(), now()),

    -- Pump: vibration CRITICAL
    ('c0000001-0001-4001-8001-00000000000b', 'b0000001-0001-4001-8001-000000000007', 'Vibration', 'vib_mm_s', 'CUSTOM', 3, 700, 1, 'FLOAT32', 'BIG', 'mm/s',
     1.0, 0.0, NULL, 6.0, NULL, 9.0, true, 0, now(), now()),
    ('c0000001-0001-4001-8001-00000000000c', 'b0000001-0001-4001-8001-000000000007', 'Motor Temp', 'motor_c', 'TEMPERATURE', 3, 702, 1, 'FLOAT32', 'BIG', '°C',
     1.0, 0.0, NULL, 75.0, NULL, 90.0, true, 1, now(), now()),

    ('c0000001-0001-4001-8001-00000000000d', 'b0000001-0001-4001-8001-000000000008', 'Position', 'pos_pct', 'STATUS', 3, 800, 1, 'UINT16', 'BIG', '%',
     1.0, 0.0, NULL, NULL, NULL, NULL, true, 0, now(), now()),

    ('c0000001-0001-4001-8001-00000000000e', 'b0000001-0001-4001-8001-000000000009', 'Level', 'level_pct', 'CUSTOM', 3, 900, 1, 'FLOAT32', 'BIG', '%',
     1.0, 0.0, NULL, 85.0, NULL, 95.0, true, 0, now(), now()),
    ('c0000001-0001-4001-8001-00000000000f', 'b0000001-0001-4001-8001-000000000009', 'Inlet Flow', 'flow_l_min', 'CUSTOM', 3, 902, 1, 'FLOAT32', 'BIG', 'L/min',
     1.0, 0.0, NULL, NULL, NULL, NULL, true, 1, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ========== device_tag_latest (drives alarm_state / quality on dashboard) ==========
INSERT INTO device_tag_latest (tag_id, device_id, value_numeric, value_text, quality, alarm_state, collected_at, updated_at)
VALUES
    ('c0000001-0001-4001-8001-000000000001', 'b0000001-0001-4001-8001-000000000001', 8.75, NULL, 'GOOD', 'WARNING', now(), now()),
    ('c0000001-0001-4001-8001-000000000002', 'b0000001-0001-4001-8001-000000000001', 128.5, NULL, 'GOOD', 'NORMAL', now(), now()),

    ('c0000001-0001-4001-8001-000000000003', 'b0000001-0001-4001-8001-000000000002', 7.2, NULL, 'GOOD', 'NORMAL', now(), now()),
    ('c0000001-0001-4001-8001-000000000004', 'b0000001-0001-4001-8001-000000000002', 2.1, NULL, 'GOOD', 'NORMAL', now(), now()),

    ('c0000001-0001-4001-8001-000000000005', 'b0000001-0001-4001-8001-000000000003', 11.8, NULL, 'GOOD', 'WARNING', now(), now()),

    ('c0000001-0001-4001-8001-000000000006', 'b0000001-0001-4001-8001-000000000004', 62.0, NULL, 'GOOD', 'NORMAL', now(), now()),
    ('c0000001-0001-4001-8001-000000000007', 'b0000001-0001-4001-8001-000000000004', 48.0, NULL, 'GOOD', 'NORMAL', now(), now()),

    ('c0000001-0001-4001-8001-000000000008', 'b0000001-0001-4001-8001-000000000005', 24.5, NULL, 'GOOD', 'NORMAL', now(), now()),

    ('c0000001-0001-4001-8001-000000000009', 'b0000001-0001-4001-8001-000000000006', 2950.0, NULL, 'GOOD', 'WARNING', now(), now()),
    ('c0000001-0001-4001-8001-000000000010', 'b0000001-0001-4001-8001-000000000006', 12.4, NULL, 'GOOD', 'NORMAL', now(), now()),

    ('c0000001-0001-4001-8001-00000000000b', 'b0000001-0001-4001-8001-000000000007', 9.2, NULL, 'GOOD', 'CRITICAL', now(), now()),
    ('c0000001-0001-4001-8001-00000000000c', 'b0000001-0001-4001-8001-000000000007', 82.0, NULL, 'GOOD', 'WARNING', now(), now()),

    ('c0000001-0001-4001-8001-00000000000d', 'b0000001-0001-4001-8001-000000000008', 42.0, NULL, 'GOOD', 'NORMAL', now(), now()),

    ('c0000001-0001-4001-8001-00000000000e', 'b0000001-0001-4001-8001-000000000009', NULL, NULL, 'TIMEOUT', 'UNKNOWN', now() - interval '2 hours', now()),
    ('c0000001-0001-4001-8001-00000000000f', 'b0000001-0001-4001-8001-000000000009', NULL, NULL, 'BAD', 'UNKNOWN', now() - interval '2 hours', now())
ON CONFLICT (tag_id) DO NOTHING;

-- ========== OPEN alarms (dashboard Quick Ack panel) ==========
INSERT INTO alarms (id, device_id, tag_id, alarm_type, severity, status, message, triggered_value, threshold_value, started_at, created_at, updated_at)
VALUES
    ('d1000001-0001-4001-8001-000000000001', 'b0000001-0001-4001-8001-000000000001', 'c0000001-0001-4001-8001-000000000001',
     'THRESHOLD', 'WARNING', 'OPEN', 'WARNING on Steam Pressure', 8.75, 8.5, now() - interval '15 minutes', now(), now()),
    ('d1000001-0001-4001-8001-000000000002', 'b0000001-0001-4001-8001-000000000007', 'c0000001-0001-4001-8001-00000000000b',
     'THRESHOLD', 'CRITICAL', 'OPEN', 'CRITICAL on Vibration', 9.2, 9.0, now() - interval '8 minutes', now(), now()),
    ('d1000001-0001-4001-8001-000000000003', 'b0000001-0001-4001-8001-000000000003', 'c0000001-0001-4001-8001-000000000005',
     'THRESHOLD', 'WARNING', 'OPEN', 'WARNING on Outlet Temp', 11.8, 11.0, now() - interval '22 minutes', now(), now()),
    ('d1000001-0001-4001-8001-000000000004', 'b0000001-0001-4001-8001-000000000009', 'c0000001-0001-4001-8001-00000000000e',
     'COMM_TIMEOUT', 'WARNING', 'OPEN', 'COMM_TIMEOUT on Level', NULL, NULL, now() - interval '1 hour', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ========== polling_logs (recent rows for Polling Status panel) ==========
INSERT INTO polling_logs (id, device_id, started_at, finished_at, result, latency_ms, created_at)
VALUES
    (gen_random_uuid(), 'b0000001-0001-4001-8001-000000000002', now() - interval '30 seconds', now() - interval '30 seconds', 'SUCCESS', 84, now()),
    (gen_random_uuid(), 'b0000001-0001-4001-8001-000000000007', now() - interval '28 seconds', now() - interval '28 seconds', 'SUCCESS', 73, now()),
    (gen_random_uuid(), 'b0000001-0001-4001-8001-000000000001', now() - interval '26 seconds', now() - interval '26 seconds', 'PARTIAL_SUCCESS', 132, now()),
    (gen_random_uuid(), 'b0000001-0001-4001-8001-000000000009', now() - interval '2 hours', now() - interval '2 hours', 'TIMEOUT', 2000, now()),
    (gen_random_uuid(), 'b0000001-0001-4001-8001-000000000004', now() - interval '20 seconds', now() - interval '20 seconds', 'SUCCESS', 69, now()),
    (gen_random_uuid(), 'b0000001-0001-4001-8001-000000000008', now() - interval '18 seconds', now() - interval '18 seconds', 'SUCCESS', 91, now());
