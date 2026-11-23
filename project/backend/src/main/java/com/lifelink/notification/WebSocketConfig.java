package com.lifelink.notification;

import com.lifelink.identity.AuthService;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.JwtService;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final JwtService jwtService;
    private final AuthService authService;
    private final List<String> allowedOrigins;

    public WebSocketConfig(JwtService jwtService, AuthService authService,
                           @Value("${security.cors.allowed-origins}") List<String> allowedOrigins) {
        this.jwtService = jwtService;
        this.authService = authService;
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins.toArray(String[]::new))
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/queue", "/topic");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                String destination = String.valueOf(message.getHeaders().get("destination"));
                if (destination.startsWith("/app")) {
                    String token = String.valueOf(message.getHeaders().get("Authorization"));
                    if (token != null && token.startsWith("Bearer ")) {
                        try {
                            Long userId = jwtService.parse(token.substring(7)).get("uid", Long.class);
                            AuthenticatedUser user = authService.principal(userId);
                            var authentication = new UsernamePasswordAuthenticationToken(
                                    user, null, user.getAuthorities());
                            SecurityContextHolder.getContext().setAuthentication(authentication);
                        } catch (Exception ignored) {
                            SecurityContextHolder.clearContext();
                        }
                    }
                }
                return message;
            }
        });
    }
}
