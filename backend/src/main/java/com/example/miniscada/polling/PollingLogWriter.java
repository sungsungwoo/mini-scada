package com.example.miniscada.polling;

import com.example.miniscada.domain.polling.PollingLogEntity;
import com.example.miniscada.domain.polling.PollingLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PollingLogWriter {

    private final PollingLogRepository pollingLogRepository;

    @Transactional
    public void append(
            UUID deviceId,
            Instant startedAt,
            Instant finishedAt,
            String result,
            Integer latencyMs,
            String errorCode,
            String errorMessage
    ) {
        PollingLogEntity e = new PollingLogEntity();
        e.setId(UUID.randomUUID());
        e.setDeviceId(deviceId);
        e.setStartedAt(startedAt);
        e.setFinishedAt(finishedAt);
        e.setResult(result);
        e.setErrorCode(truncate(errorCode, 50));
        e.setErrorMessage(truncate(errorMessage, 8000));
        e.setLatencyMs(latencyMs);
        e.setCreatedAt(Instant.now());
        pollingLogRepository.save(e);
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
