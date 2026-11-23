package com.lifelink.identity;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    public static final String TOKEN_VERSION_CLAIM = "token_version";
    private static final String TEST_SECRET = "test-only-jwt-secret-not-for-production-0123456789";

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
        boolean testProfile = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> profile.equals("test"));
        if (!testProfile && TEST_SECRET.equals(secret)) {
            throw new IllegalStateException("JWT_SECRET must be a strong application-specific secret");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.accessTokenMinutes = accessTokenMinutes;
        this.issuer = issuer;
        this.audience = audience;
    }

    /** jti gives each access token a unique id; token_version binds it to a persistent revocation counter. */
    public String generateAccessToken(AuthenticatedUser user, String tokenVersion) {
        Instant now = Instant.now();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(user.email())
                .issuer(issuer)
                .audience().add(audience).and()
                .claim("uid", user.userId())
                .claim("roles", user.roles().stream().map(Role::name).toList())
                .claim(TOKEN_VERSION_CLAIM, tokenVersion)
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
