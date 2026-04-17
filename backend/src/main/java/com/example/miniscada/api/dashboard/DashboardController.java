package com.example.miniscada.api.dashboard;

import com.example.miniscada.api.dashboard.dto.DashboardDtos.ActiveAlarmsData;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.DashboardOverview;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.DeviceListData;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.PollingLogsData;
import com.example.miniscada.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/overview")
    public ApiResponse<DashboardOverview> overview(
            @RequestParam(defaultValue = "true") boolean includeActiveAlarms
    ) {
        return ApiResponse.ok(dashboardService.overview(includeActiveAlarms));
    }

    @GetMapping("/devices")
    public ApiResponse<DeviceListData> devices(
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String alarmState,
            @RequestParam(required = false) String keyword
    ) {
        return ApiResponse.ok(dashboardService.devices(page, size, status, alarmState, keyword));
    }

    @GetMapping("/active-alarms")
    public ApiResponse<ActiveAlarmsData> activeAlarms(@RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.ok(dashboardService.activeAlarms(limit));
    }

    @GetMapping("/polling-logs")
    public ApiResponse<PollingLogsData> pollingLogs(@RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.ok(dashboardService.pollingLogs(limit));
    }
}
