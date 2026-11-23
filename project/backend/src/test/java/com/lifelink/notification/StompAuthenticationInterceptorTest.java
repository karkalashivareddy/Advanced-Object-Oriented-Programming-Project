package com.lifelink.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lifelink.identity.AuthService;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.JwtService;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import io.jsonwebtoken.Claims;
import java.util.EnumSet;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

class StompAuthenticationInterceptorTest {

    private final JwtService jwtService = mock(JwtService.class);
    private final AuthService authService = mock(AuthService.class);
    private final StompAuthenticationInterceptor interceptor =
            new StompAuthenticationInterceptor(jwtService, authService);
    private final MessageChannel channel = mock(MessageChannel.class);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void connectRequiresBearerToken() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message, channel));
    }

    @Test
    void connectAuthenticatesJwtSubject() {
        Claims claims = mock(Claims.class);
        when(claims.get("uid")).thenReturn(42L);
        when(jwtService.parse("valid-jwt")).thenReturn(claims);
        AuthenticatedUser user = user();
        when(authService.principal(42L)).thenReturn(user);

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setNativeHeader("Authorization", "Bearer valid-jwt");
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> result = interceptor.preSend(message, channel);
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
        Authentication authentication = assertInstanceOf(Authentication.class, resultAccessor.getUser());
        assertEquals("donor@lifelink.local", authentication.getName());
        verify(authService).principal(42L);
    }

    @Test
    void subscribeCannotTargetAnotherUsersQueue() {
        Authentication authentication = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                user(), null, user().getAuthorities());
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination("/user/other@lifelink.local/queue/notifications");
        accessor.setUser(authentication);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message, channel));
    }

    @Test
    void subscribeToOwnGenericQueueIsAllowed() {
        Authentication authentication = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                user(), null, user().getAuthorities());
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination("/user/queue/notifications");
        accessor.setUser(authentication);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertEquals(message, interceptor.preSend(message, channel));
    }

    private AuthenticatedUser user() {
        return new AuthenticatedUser(42L, "donor@lifelink.local", "Demo Donor",
                Set.of(Role.DONOR), EnumSet.of(Permission.DONOR_READ, Permission.NOTIFICATION_READ),
                Set.of(), Set.of());
    }
}
