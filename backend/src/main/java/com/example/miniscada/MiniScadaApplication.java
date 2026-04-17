package com.example.miniscada;

import com.example.miniscada.config.JwtProperties;
import com.example.miniscada.config.MqttProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties({JwtProperties.class, MqttProperties.class})
public class MiniScadaApplication {

    public static void main(String[] args) {
        SpringApplication.run(MiniScadaApplication.class, args);
    }
}
