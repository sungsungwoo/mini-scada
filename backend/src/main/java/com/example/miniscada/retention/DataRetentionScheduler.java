package com.example.miniscada.retention;

import com.example.miniscada.domain.policy.SystemDataPolicyEntity;
import com.example.miniscada.domain.policy.SystemDataPolicyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.retention.enabled", havingValue = "true", matchIfMissing = true)
public class DataRetentionScheduler {

    public static final String HYPERTABLE_RAW = "tag_readings";
    public static final String CONTINUOUS_AGGREGATE = "tag_readings_10m";

    private final SystemDataPolicyRepository policyRepository;
    private final JdbcTemplate jdbcTemplate;

    @Scheduled(cron = "${app.retention.cron:0 0 3 * * *}", zone = "${app.retention.zone:UTC}")
    public void runRetention() {
        if (!isTimescaleAvailable()) {
            log.debug("TimescaleDB extension not present; skipping data retention");
            return;
        }
        SystemDataPolicyEntity policy = policyRepository.findById(1).orElse(null);
        if (policy == null) {
            log.warn("system_data_policy id=1 not found; skipping data retention");
            return;
        }
        Instant rawCutoff = Instant.now().minus(policy.getRawRetentionDays(), ChronoUnit.DAYS);
        Instant aggCutoff = Instant.now().minus(policy.getAggregateRetentionDays(), ChronoUnit.DAYS);
        try {
            dropChunksOlderThan(HYPERTABLE_RAW, rawCutoff);
            log.info(
                    "Retention: dropped chunks on {} older than {} (raw_retention_days={})",
                    HYPERTABLE_RAW,
                    rawCutoff,
                    policy.getRawRetentionDays()
            );
        } catch (Exception e) {
            log.error("Retention failed for {}: {}", HYPERTABLE_RAW, e.getMessage(), e);
        }
        try {
            dropChunksOlderThan(CONTINUOUS_AGGREGATE, aggCutoff);
            log.info(
                    "Retention: dropped chunks on {} older than {} (aggregate_retention_days={})",
                    CONTINUOUS_AGGREGATE,
                    aggCutoff,
                    policy.getAggregateRetentionDays()
            );
        } catch (Exception e) {
            log.error("Retention failed for {}: {}", CONTINUOUS_AGGREGATE, e.getMessage(), e);
        }
    }

    private boolean isTimescaleAvailable() {
        Boolean ok = jdbcTemplate.query(
                "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')",
                rs -> {
                    if (!rs.next()) {
                        return false;
                    }
                    return rs.getBoolean(1);
                }
        );
        return Boolean.TRUE.equals(ok);
    }

    private void dropChunksOlderThan(String relationName, Instant olderThan) {
        jdbcTemplate.execute((ConnectionCallback<Void>) con -> {
            try (PreparedStatement ps = con.prepareStatement(
                    "SELECT drop_chunks(relation => ?::regclass, older_than => ?::timestamptz)")) {
                ps.setString(1, relationName);
                ps.setTimestamp(2, Timestamp.from(olderThan));
                ps.execute();
            }
            return null;
        });
    }
}
