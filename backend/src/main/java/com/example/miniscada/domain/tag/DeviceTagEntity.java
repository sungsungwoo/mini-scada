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
@Table(name = "device_tags")
@Getter
@Setter
@NoArgsConstructor
public class DeviceTagEntity {

    @Id
    private UUID id;

    @Column(name = "device_id", nullable = false)
    private UUID deviceId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 100)
    private String code;

    private String description;

    @Column(name = "tag_type", nullable = false, length = 30)
    private String tagType = "CUSTOM";

    @Column(name = "function_code", nullable = false)
    private int functionCode;

    @Column(nullable = false)
    private int address;

    @Column(nullable = false)
    private int quantity = 1;

    @Column(name = "data_type", nullable = false, length = 30)
    private String dataType;

    @Column(name = "byte_order", length = 20)
    private String byteOrder;

    private String unit;

    @Column(name = "scale_factor", nullable = false)
    private BigDecimal scaleFactor = BigDecimal.ONE;

    @Column(name = "offset_value", nullable = false)
    private BigDecimal offsetValue = BigDecimal.ZERO;

    private BigDecimal warningMin;
    private BigDecimal warningMax;
    private BigDecimal criticalMin;
    private BigDecimal criticalMax;
    private BigDecimal deadband;

    @Column(name = "is_enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
