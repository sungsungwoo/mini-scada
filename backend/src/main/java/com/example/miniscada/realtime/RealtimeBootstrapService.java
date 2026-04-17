package com.example.miniscada.realtime;

import com.example.miniscada.api.dashboard.DashboardService;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.DashboardOverview;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RealtimeBootstrapService {

    private final DashboardService dashboardService;

    public Map<String, Object> bootstrap() {
        DashboardOverview ov = dashboardService.overview(true);
        List<String> topics = List.of(
                "/scada/{deviceId}/status",
                "/scada/{deviceId}/{tag}",
                "/scada/alarm"
        );
        return Map.of(
                "snapshot", ov,
                "topics", topics
        );
    }
}
