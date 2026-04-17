package com.example.miniscada.realtime;

import com.example.miniscada.config.MqttProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Slf4j
@Service
public class MqttPublishService {

    private final MqttProperties props;
    private final ObjectMapper objectMapper;
    private volatile MqttClient client;

    public MqttPublishService(MqttProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
    }

    public synchronized void ensureConnected() {
        if (!props.isEnabled() || client != null && client.isConnected()) {
            return;
        }
        try {
            String id = props.getClientId() + "-" + UUID.randomUUID().toString().substring(0, 8);
            client = new MqttClient(props.getBrokerUrl(), id, new MemoryPersistence());
            MqttConnectOptions o = new MqttConnectOptions();
            o.setAutomaticReconnect(true);
            o.setConnectionTimeout(5);
            client.connect(o);
            log.info("MQTT connected to {}", props.getBrokerUrl());
        } catch (MqttException e) {
            log.warn("MQTT connect failed: {}", e.getMessage());
            client = null;
        }
    }

    public boolean isConnected() {
        return client != null && client.isConnected();
    }

    public void publish(String topicSuffix, String jsonPayload) {
        if (!props.isEnabled()) {
            return;
        }
        ensureConnected();
        if (client == null || !client.isConnected()) {
            return;
        }
        String topic = props.getTopicPrefix() + topicSuffix;
        try {
            MqttMessage m = new MqttMessage(jsonPayload.getBytes(StandardCharsets.UTF_8));
            m.setQos(0);
            client.publish(topic, m);
        } catch (MqttException e) {
            log.warn("MQTT publish failed {}: {}", topic, e.getMessage());
        }
    }

    public void publishJson(String topicSuffix, Object payload) {
        try {
            publish(topicSuffix, objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            log.warn("MQTT JSON serialize failed: {}", e.getMessage());
        }
    }
}
