package com.example.miniscada.domain.tag;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DeviceTagRepository extends JpaRepository<DeviceTagEntity, UUID> {

    List<DeviceTagEntity> findByDeviceIdOrderByDisplayOrderAsc(UUID deviceId);

    boolean existsByDeviceIdAndCode(UUID deviceId, String code);

    boolean existsByDeviceIdAndFunctionCodeAndAddress(UUID deviceId, int functionCode, int address);

    boolean existsByDeviceIdAndFunctionCodeAndAddressAndIdNot(UUID deviceId, int functionCode, int address, UUID id);

    long countByDeviceId(UUID deviceId);
}
