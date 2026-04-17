package com.example.miniscada.domain.polling;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PollingLogRepository extends JpaRepository<PollingLogEntity, UUID> {

    List<PollingLogEntity> findByOrderByStartedAtDesc(Pageable pageable);
}
