package com.lifelink.identity;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.lifelink.identity.dto.AuthDtos.ChangePasswordRequest;
import com.lifelink.identity.dto.AuthDtos.RegisterRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

class PasswordValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void weakRegistrationPasswordsAreRejected() {
        assertFalse(validator.validate(new RegisterRequest(
                "member@example.test", "password123", "Test Member", null)).isEmpty());
        assertFalse(validator.validate(new RegisterRequest(
                "member@example.test", "PASSWORD123", "Test Member", null)).isEmpty());
    }

    @Test
    void strongRegistrationAndChangePasswordsAreAccepted() {
        assertTrue(validator.validate(new RegisterRequest(
                "member@example.test", "StrongPass1!", "Test Member", null)).isEmpty());
        assertTrue(validator.validate(new ChangePasswordRequest(
                "current-password", "StrongPass1!")).isEmpty());
    }
}
