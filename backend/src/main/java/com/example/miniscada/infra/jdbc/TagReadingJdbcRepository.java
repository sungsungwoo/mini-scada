package com.example.miniscada.infra.jdbc;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class TagReadingJdbcRepository {

    private final JdbcTemplate jdbcTemplate;

    public void insert(
            Instant time,
            UUID tagId,
            UUID deviceId,
            BigDecimal valueNumeric,
            String quality,
            String alarmState
    ) {
        jdbcTemplate.update(
                """
                        INSERT INTO tag_readings (time, tag_id, device_id, value_numeric, quality, alarm_state, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, now())
                        """,
                Timestamp.from(time),
                tagId,
                deviceId,
                valueNumeric,
                quality,
                alarmState
        );
    }

    public List<TsPoint> fetchSeries(UUID deviceId, UUID tagId, Instant from, Instant to, int limit) {
        return jdbcTemplate.query(
                """
                        SELECT time, value_numeric FROM tag_readings
                        WHERE device_id = ? AND tag_id = ?
                        AND time >= ? AND time <= ?
                        ORDER BY time ASC
                        LIMIT ?
                        """,
                (rs, rowNum) -> new TsPoint(rs.getTimestamp("time").toInstant(), rs.getBigDecimal("value_numeric")),
                deviceId,
                tagId,
                Timestamp.from(from),
                Timestamp.from(to),
                limit
        );
    }

    public record TsPoint(Instant timestamp, BigDecimal value) {
    }
}
