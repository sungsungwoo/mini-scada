package com.example.miniscada.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.auth-session")
public class AuthSessionProperties {

    /**
     * No API activity for this long → {@code /auth/refresh} is rejected (sliding idle window).
     */
    private long idleTimeoutMs = 3_600_000L;

    /**
     * Hard stop: {@code created_at + absoluteMaxMs} from first login/registration in this session.
     */
    private long absoluteMaxMs = 86_400_000L;

    /**
     * Refresh token credential lifetime (extended on each successful refresh rotation).
     */
    private long refreshExpirationMs = 86_400_000L;
}
