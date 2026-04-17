package com.example.miniscada.domain.device;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DeviceGroupRepository extends JpaRepository<DeviceGroupEntity, UUID> {

    Optional<DeviceGroupEntity> findByName(String name);
}
