CREATE TABLE alarms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
    tag_id UUID REFERENCES device_tags (id) ON DELETE SET NULL,
    alarm_type VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    message VARCHAR(255) NOT NULL,
    triggered_value NUMERIC(24, 8),
    threshold_value NUMERIC(24, 8),
    started_at TIMESTAMPTZ NOT NULL,
    acked_at TIMESTAMPTZ,
    cleared_at TIMESTAMPTZ,
    acked_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_alarms_severity CHECK (severity IN ('WARNING', 'CRITICAL')),
    CONSTRAINT chk_alarms_status CHECK (status IN ('OPEN', 'ACKED', 'CLEARED')),
    CONSTRAINT chk_alarms_type CHECK (alarm_type IN ('THRESHOLD', 'DEVICE_OFFLINE', 'COMM_TIMEOUT', 'QUALITY_BAD'))
);

CREATE INDEX idx_alarms_device ON alarms (device_id);
CREATE INDEX idx_alarms_tag ON alarms (tag_id);
CREATE INDEX idx_alarms_started ON alarms (started_at DESC);
CREATE INDEX idx_alarms_status ON alarms (status);
