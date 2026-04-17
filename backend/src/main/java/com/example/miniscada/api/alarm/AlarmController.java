package com.example.miniscada.api.alarm;

import com.example.miniscada.api.alarm.dto.AlarmApiDtos.AckResponse;
import com.example.miniscada.api.alarm.dto.AlarmApiDtos.AlarmDetail;
import com.example.miniscada.api.alarm.dto.AlarmApiDtos.AlarmListData;
import com.example.miniscada.api.alarm.dto.AlarmApiDtos.BulkAckData;
import com.example.miniscada.api.alarm.dto.AlarmApiDtos.BulkAckRequest;
import com.example.miniscada.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/alarms")
@RequiredArgsConstructor
public class AlarmController {

    private final AlarmService alarmService;

    @GetMapping
    public ApiResponse<AlarmListData> list(
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) Boolean acknowledged,
            @RequestParam(required = false) UUID deviceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.ok(alarmService.list(severity, acknowledged, deviceId, from, to, keyword, page, size));
    }

    @GetMapping("/{alarmId}")
    public ApiResponse<AlarmDetail> detail(@PathVariable UUID alarmId) {
        return ApiResponse.ok(alarmService.get(alarmId));
    }

    @PostMapping("/{alarmId}/ack")
    public ApiResponse<AckResponse> ack(@PathVariable UUID alarmId, Authentication authentication) {
        UUID userId = UUID.fromString(authentication.getName());
        return ApiResponse.ok(alarmService.ack(alarmId, userId));
    }

    @PostMapping("/ack/bulk")
    public ApiResponse<BulkAckData> bulkAck(@Valid @RequestBody BulkAckRequest body, Authentication authentication) {
        UUID userId = UUID.fromString(authentication.getName());
        return ApiResponse.ok(alarmService.bulkAck(body.alarm_ids(), userId));
    }
}
