package com.lifelink.identity;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private static final String DEVELOPMENT_SECRET = "local-development-only-secret-change-me-lifelink-2026";

    private final SecretKey key;
    private final long accessTokenMinutes;
    private final String issuer;
    private final String audience;

    public JwtService(@Value("${security.jwt.secret}") String secret,
                      @Value("${security.jwt.access-token-minutes}") long accessTokenMinutes,
                      @Value("${security.jwt.issuer:lifelink}") String issuer,
                      @Value("${security.jwt.audience:lifelink-api}") String audience,
                      Environment environment) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("JWT secret must be at least 32 bytes");
        }
        boolean nonDevelopment = Arrays.stream(environment.getActiveProfiles())
                .noneMatch(profile -> profile.equals("dev") || profile.equals("test"));
        if (nonDevelopment && DEVELOPMENT_SECRET.equals(secret)) {
            throw new IllegalStateException("JWT_SECRET must be set outside local development and test profiles");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.accessTokenMinutes = accessTokenMinutes;
        this.issuer = issuer;
        this.audience = audience;
    }

    public String generateAccessToken(AuthenticatedUser user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.email())
                .issuer(issuer)
                .audience().add(audience).and()
                .claim("uid", user.userId())
                .claim("roles", user.roles().stream().map(Role::name).toList())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(accessTokenMinutes * 60)))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .requireIssuer(issuer)
                .requireAudience(audience)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long accessTokenSeconds() {
        return accessTokenMinutes * 60;
    }
}
