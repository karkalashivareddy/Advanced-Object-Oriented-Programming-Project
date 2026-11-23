package com.lifelink.organization.dto;

import com.lifelink.organization.Organization;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class OrganizationDtos {
    private OrganizationDtos() {
    }

    public record CreateRequest(
            @NotBlank String name,
            @NotNull Organization.Type type,
            @NotBlank String registrationCode,
            String city,
            String state,
            @NotBlank @Email String contactEmail,
            String phone,
            String serviceArea) {
    }

    public record UpdateRequest(
            @NotBlank String name, String city, String state,
            @NotBlank @Email String contactEmail, String phone, String serviceArea) {
    }

    public record View(Long id, String publicId, String name, Organization.Type type, String registrationCode,
                       String city, String state, String contactEmail, String phone, boolean verified,
                       boolean active, String serviceArea) {
        public static View of(Organization organization) {
            return new View(organization.getId(), organization.getPublicId(), organization.getName(),
                    organization.getType(), organization.getRegistrationCode(), organization.getCity(),
                    organization.getState(), organization.getContactEmail(), organization.getPhone(),
                    organization.isVerified(), organization.isActive(), organization.getServiceArea());
        }
    }
}
