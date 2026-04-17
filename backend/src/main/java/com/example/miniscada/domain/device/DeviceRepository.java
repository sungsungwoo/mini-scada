package com.example.miniscada.domain.device;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceRepository extends JpaRepository<DeviceEntity, UUID>, JpaSpecificationExecutor<DeviceEntity> {

    Optional<DeviceEntity> findByCode(String code);

    boolean existsByIpAddressAndPortAndSlaveId(String ipAddress, Integer port, Integer slaveId);

    /**
     * 수정 시 자기 자신은 제외. 메서드명 기반 {@code ...AndIdNot} 파싱이 환경에 따라 달라질 수 있어 JPQL로 고정.
     */
    @Query("""
            select case when count(d) > 0 then true else false end
            from DeviceEntity d
            where d.ipAddress = :ip and d.port = :port and d.slaveId = :slaveId and d.id <> :excludeId
            """)
    boolean existsOtherWithSameConn(
            @Param("ip") String ip,
            @Param("port") Integer port,
            @Param("slaveId") Integer slaveId,
            @Param("excludeId") UUID excludeId);

    List<DeviceEntity> findByActiveTrueOrderByNameAsc();

    long countByActiveTrue();

    long countByActiveTrueAndStatus(String status);
}
