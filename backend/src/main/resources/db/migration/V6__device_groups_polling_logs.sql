-- ERD: device_groups + polling_logs; optional grouping for devices

CREATE TABLE device_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE devices
    ADD COLUMN device_group_id UUID REFERENCES device_groups (id);

CREATE INDEX idx_devices_device_group ON devices (device_group_id);

CREATE TABLE polling_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    result VARCHAR(20) NOT NULL,
    error_code VARCHAR(50),
    error_message TEXT,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_polling_logs_result CHECK (result IN ('SUCCESS', 'TIMEOUT', 'ERROR', 'PARTIAL_SUCCESS'))
);

CREATE INDEX idx_polling_logs_device ON polling_logs (device_id);
CREATE INDEX idx_polling_logs_started ON polling_logs (started_at DESC);
