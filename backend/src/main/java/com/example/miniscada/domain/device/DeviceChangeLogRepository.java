package com.example.miniscada.domain.device;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface DeviceChangeLogRepository extends JpaRepository<DeviceChangeLogEntity, UUID> {

    Page<DeviceChangeLogEntity> findByDeviceIdOrderByOccurredAtDesc(UUID deviceId, Pageable pageable);
}
