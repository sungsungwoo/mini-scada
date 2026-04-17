package com.example.miniscada.api.device;

import com.example.miniscada.api.device.dto.DeviceDtos.CurrentTagsData;
import com.example.miniscada.api.device.dto.DeviceDtos.DeviceDetail;
import com.example.miniscada.api.device.dto.DeviceDtos.DeviceEventsData;
import com.example.miniscada.api.device.dto.DeviceDtos.TimeseriesData;
import com.example.miniscada.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/devices")
@RequiredArgsConstructor
public class DeviceQueryController {

    private final DeviceQueryService deviceQueryService;

    @GetMapping("/{deviceId}")
    public ApiResponse<DeviceDetail> detail(@PathVariable UUID deviceId) {
        return ApiResponse.ok(deviceQueryService.getDevice(deviceId));
    }

    @GetMapping("/{deviceId}/timeseries")
    public ApiResponse<TimeseriesData> timeseries(
            @PathVariable UUID deviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) String bucket,
            @RequestParam(required = false) String tagIds
    ) {
        return ApiResponse.ok(deviceQueryService.timeseries(deviceId, from, to, tagIds));
    }

    @GetMapping("/{deviceId}/events")
    public ApiResponse<DeviceEventsData> events(
            @PathVariable UUID deviceId,
            @RequestParam(required = false) String types,
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ApiResponse.ok(deviceQueryService.events(deviceId, types, limit));
    }

    @GetMapping("/{deviceId}/tags/current")
    public ApiResponse<CurrentTagsData> currentTags(@PathVariable UUID deviceId) {
        return ApiResponse.ok(deviceQueryService.currentTags(deviceId));
    }
}
