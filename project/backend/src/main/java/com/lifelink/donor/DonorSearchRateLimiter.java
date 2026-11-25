package com.lifelink.donor;

import com.lifelink.common.exception.RateLimitedException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** Per-process abuse guard. Production deployments should additionally enforce a shared gateway limit. */
@Component
public class DonorSearchRateLimiter {
    private static final int MAX_SEARCHES = 20;
    private static final Duration WINDOW = Duration.ofMinutes(1);
    private final ConcurrentHashMap<Long, ArrayDeque<Instant>> attempts = new ConcurrentHashMap<>();

    public void check(Long actorId, Instant now) {
        if (actorId == null) throw new IllegalArgumentException("Authenticated actor is required");
        ArrayDeque<Instant> window = attempts.computeIfAbsent(actorId, ignored -> new ArrayDeque<>());
        synchronized (window) {
            Instant cutoff = now.minus(WINDOW);
            while (!window.isEmpty() && !window.peekFirst().isAfter(cutoff)) window.removeFirst();
            if (window.size() >= MAX_SEARCHES) {
                throw new RateLimitedException("Donor discovery search limit reached; try again shortly");
            }
            window.addLast(now);
        }
        if (attempts.size() > 10_000) {
            attempts.entrySet().removeIf(entry -> entry.getValue().isEmpty());
        }
    }
}
