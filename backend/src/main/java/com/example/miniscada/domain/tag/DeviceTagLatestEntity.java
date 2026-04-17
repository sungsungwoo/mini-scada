package com.example.miniscada.domain.tag;

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
@Table(name = "device_tag_latest")
@Getter
@Setter
@NoArgsConstructor
public class DeviceTagLatestEntity {

    @Id
    @Column(name = "tag_id")
    private UUID tagId;

    @Column(name = "device_id", nullable = false)
    private UUID deviceId;

    @Column(name = "value_numeric")
    private BigDecimal valueNumeric;

    @Column(name = "value_text")
    private String valueText;

    @Column(nullable = false, length = 20)
    private String quality = "GOOD";

    @Column(name = "alarm_state", nullable = false, length = 20)
    private String alarmState = "NORMAL";

    @Column(name = "collected_at", nullable = false)
    private Instant collectedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
