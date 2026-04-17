package com.example.miniscada.security;

import com.example.miniscada.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class JwtTokenProvider {

    private final JwtProperties props;
    private final SecretKey key;

    public JwtTokenProvider(JwtProperties props) {
        this.props = props;
        byte[] bytes = props.getSecret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("app.jwt.secret must be at least 32 bytes for HS256");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
    }

    public String createToken(UUID userId, String username, java.util.Collection<String> roles) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + props.getExpirationMs());
        String rolesCsv = roles.stream().sorted().collect(Collectors.joining(","));
        return Jwts.builder()
                .subject(userId.toString())
                .claim("username", username)
                .claim("roles", rolesCsv)
                .issuedAt(now)
                .expiration(exp)
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public UUID parseUserId(String token) {
        String sub = parse(token).getSubject();
        return UUID.fromString(sub);
    }
}
