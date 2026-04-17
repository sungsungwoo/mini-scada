package com.example.miniscada.security;

import com.example.miniscada.domain.user.AppUser;
import com.example.miniscada.domain.user.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScadaUserDetailsService implements UserDetailsService {

    private final AppUserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        AppUser u = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException(username));
        if (!u.isActive()) {
            throw new UsernameNotFoundException("inactive");
        }
        String[] roles = u.getRoles().stream()
                .map(r -> "ROLE_" + r.getName())
                .toArray(String[]::new);
        return User.builder()
                .username(u.getUsername())
                .password(u.getPasswordHash())
                .authorities(roles)
                .build();
    }
}
