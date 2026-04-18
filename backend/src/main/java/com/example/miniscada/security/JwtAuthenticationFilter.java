package com.example.miniscada.security;

import com.example.miniscada.api.auth.AuthSessionService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final AuthSessionService authSessionService;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider, AuthSessionService authSessionService) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.authSessionService = authSessionService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                Claims claims = jwtTokenProvider.parse(token);
                UUID userId = UUID.fromString(claims.getSubject());
                String sidStr = claims.get("sid", String.class);
                if (sidStr == null || sidStr.isBlank()) {
                    SecurityContextHolder.clearContext();
                } else {
                    UUID sessionId = UUID.fromString(sidStr);
                    authSessionService.validateAndTouch(sessionId, userId);
                    String rolesCsv = claims.get("roles", String.class);
                    List<SimpleGrantedAuthority> authorities = Arrays.stream(rolesCsv.split(","))
                            .filter(s -> !s.isBlank())
                            .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                            .toList();
                    var auth = new UsernamePasswordAuthenticationToken(userId.toString(), null, authorities);
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception ignored) {
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }
}
