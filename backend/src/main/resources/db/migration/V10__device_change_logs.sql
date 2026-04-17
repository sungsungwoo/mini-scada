-- 설비 설정 변경 이력 (관리자). devices 에 FK 를 두지 않아 설비 삭제 후에도 로그 행이 보존됩니다.
CREATE TABLE device_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL,
    summary TEXT NOT NULL,
    CONSTRAINT chk_device_change_action CHECK (
        action IN ('CREATE', 'UPDATE', 'ENABLE', 'DISABLE', 'DELETE')
    )
);

CREATE INDEX idx_device_change_logs_device_occurred ON device_change_logs (device_id, occurred_at DESC);
