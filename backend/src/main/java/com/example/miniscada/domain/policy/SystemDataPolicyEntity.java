package com.example.miniscada.domain.policy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "system_data_policy")
@Getter
@Setter
@NoArgsConstructor
public class SystemDataPolicyEntity {

    @Id
    private Integer id = 1;

    @Column(name = "raw_retention_days", nullable = false)
    private int rawRetentionDays;

    @Column(name = "aggregate_retention_days", nullable = false)
    private int aggregateRetentionDays;

    @Column(name = "downsampling_interval", nullable = false, length = 32)
    private String downsamplingInterval;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
