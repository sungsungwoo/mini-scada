package com.example.miniscada.domain.tag;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceTagLatestRepository extends JpaRepository<DeviceTagLatestEntity, UUID> {

    List<DeviceTagLatestEntity> findByDeviceId(UUID deviceId);

    Optional<DeviceTagLatestEntity> findByTagId(UUID tagId);
}
