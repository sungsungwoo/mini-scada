package com.example.miniscada.domain.alarm;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AlarmRepository extends JpaRepository<AlarmEntity, UUID>, JpaSpecificationExecutor<AlarmEntity> {

    long countByStatus(String status);

    Optional<AlarmEntity> findFirstByDeviceIdAndTagIdAndAlarmTypeAndStatus(
            UUID deviceId, UUID tagId, String alarmType, String status);

    List<AlarmEntity> findByDeviceIdOrderByStartedAtDesc(UUID deviceId, Pageable pageable);

    List<AlarmEntity> findByStatusOrderByStartedAtDesc(String status, Pageable pageable);

    Page<AlarmEntity> findAllByOrderByStartedAtDesc(Pageable pageable);
}
