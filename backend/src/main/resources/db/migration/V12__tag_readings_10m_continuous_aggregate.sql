-- 10분 단위 연속 집계(기본 downsampling_interval '10m' 과 정합). Raw(`tag_readings`)보다 긴 보존은 aggregate_retention_days 로 관리.
-- TimescaleDB 전제(로컬/배포 동일).

CREATE MATERIALIZED VIEW tag_readings_10m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket(INTERVAL '10 minutes', tr."time") AS bucket,
    tr.tag_id,
    tr.device_id,
    avg(tr.value_numeric) AS value_avg,
    min(tr.value_numeric) AS value_min,
    max(tr.value_numeric) AS value_max,
    count(*)::bigint AS sample_count
FROM tag_readings tr
GROUP BY 1, 2, 3;

-- 백그라운드로 raw 에서 집계 갱신 (간격은 시드 기본 정책과 맞춤)
SELECT add_continuous_aggregate_policy(
    'tag_readings_10m',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '10 minutes'
);
