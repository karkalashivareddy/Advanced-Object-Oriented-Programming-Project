package com.lifelink.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Exposes a non-sensitive mode flag so the UI can label synthetic records honestly. */
@RestController
@RequestMapping("/api/v1/runtime")
public class RuntimeModeController {
    private final boolean demoDataEnabled;

    public RuntimeModeController(@Value("${lifelink.seed.enabled:false}") boolean demoDataEnabled) {
        this.demoDataEnabled = demoDataEnabled;
    }

    @GetMapping("/mode")
    public ApiResponse<RuntimeModeView> mode() {
        return ApiResponse.ok(new RuntimeModeView(demoDataEnabled));
    }

    public record RuntimeModeView(boolean demoDataEnabled) {
    }
}
