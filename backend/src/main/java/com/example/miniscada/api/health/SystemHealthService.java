package com.example.miniscada.api.health;

import com.example.miniscada.realtime.MqttPublishService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SystemHealthService {

    private final JdbcTemplate jdbcTemplate;
    private final MqttPublishService mqttPublishService;

    public Map<String, String> summary() {
        String tsdb = "DOWN";
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            tsdb = "UP";
        } catch (Exception ignored) {
        }
        mqttPublishService.ensureConnected();
        String mqtt = mqttPublishService.isConnected() ? "UP" : "DOWN";
        Map<String, String> m = new LinkedHashMap<>();
        m.put("api", "UP");
        m.put("mqttBroker", mqtt);
        m.put("tsdb", tsdb);
        return m;
    }
}
