package com.example.miniscada.domain.device;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "devices")
@Getter
@Setter
@NoArgsConstructor
public class DeviceEntity {

    @Id
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, unique = true, length = 100)
    private String code;

    private String description;

    @Column(name = "protocol_type", nullable = false, length = 20)
    private String protocolType;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    private Integer port;

    @Column(name = "slave_id")
    private Integer slaveId;

    @Column(name = "device_group_id")
    private UUID deviceGroupId;

    @Column(name = "polling_interval_sec", nullable = false)
    private int pollingIntervalSec = 5;

    @Column(name = "timeout_ms", nullable = false)
    private int timeoutMs = 2000;

    @Column(name = "retry_count", nullable = false)
    private int retryCount = 3;

    @Column(name = "offline_threshold_sec", nullable = false)
    private int offlineThresholdSec = 15;

    @Column(nullable = false, length = 20)
    private String status = "UNKNOWN";

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
