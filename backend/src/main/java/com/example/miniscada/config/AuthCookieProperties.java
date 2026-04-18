package com.example.miniscada.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.auth-cookie")
public class AuthCookieProperties {

    /**
     * {@code Secure} flag on refresh cookie (required for {@code SameSite=None} cross-site).
     */
    private boolean secure = false;

    private String sameSite = "Lax";
}
