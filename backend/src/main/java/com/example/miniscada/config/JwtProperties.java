package com.example.miniscada.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

    /**
     * HS256 key material (UTF-8); use at least 32 bytes in production.
     */
    private String secret = "change-me";

    private long expirationMs = 86400000L;
}
