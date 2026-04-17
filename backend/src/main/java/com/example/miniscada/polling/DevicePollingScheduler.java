package com.example.miniscada.polling;

import com.example.miniscada.domain.device.DeviceEntity;
import com.example.miniscada.domain.device.DeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class DevicePollingScheduler {

    private final DeviceRepository deviceRepository;
    private final ModbusDevicePollService modbusDevicePollService;

    private final Map<UUID, Long> lastPollStartMs = new ConcurrentHashMap<>();

    @Scheduled(
            fixedDelayString = "${app.polling.scheduler-ms:1000}",
            initialDelayString = "${app.polling.initial-delay-ms:15000}"
    )
    public void tick() {
        long now = System.currentTimeMillis();
        for (DeviceEntity d : deviceRepository.findByActiveTrueOrderByNameAsc()) {
            if (!"MODBUS_TCP".equalsIgnoreCase(d.getProtocolType())) {
                continue;
            }
            long intervalMs = Math.max(1000L, (long) d.getPollingIntervalSec() * 1000L);
            Long prev = lastPollStartMs.get(d.getId());
            if (prev != null && now - prev < intervalMs) {
                continue;
            }
            lastPollStartMs.put(d.getId(), now);
            try {
                modbusDevicePollService.pollDevice(d.getId());
            } catch (Exception e) {
                log.warn("Scheduled poll error {}: {}", d.getCode(), e.getMessage());
            }
        }
    }
}
