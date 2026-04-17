package com.example.miniscada.domain.alarm;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "alarms")
@Getter
@Setter
@NoArgsConstructor
public class AlarmEntity {

    @Id
    private UUID id;

    @Column(name = "device_id", nullable = false)
    private UUID deviceId;

    @Column(name = "tag_id")
    private UUID tagId;

    @Column(name = "alarm_type", nullable = false, length = 30)
    private String alarmType;

    @Column(nullable = false, length = 20)
    private String severity;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(nullable = false, length = 255)
    private String message;

    @Column(name = "triggered_value")
    private BigDecimal triggeredValue;

    @Column(name = "threshold_value")
    private BigDecimal thresholdValue;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "acked_at")
    private Instant ackedAt;

    @Column(name = "cleared_at")
    private Instant clearedAt;

    @Column(name = "acked_by")
    private UUID ackedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
