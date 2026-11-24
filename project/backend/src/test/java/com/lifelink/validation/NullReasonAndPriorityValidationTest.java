package com.lifelink.validation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lifelink.audit.AuditService;
import com.lifelink.common.GlobalExceptionHandler;
import com.lifelink.common.exception.ErrorCode;
import com.lifelink.common.exception.ValidationException;
import com.lifelink.donor.AppointmentRepository;
import com.lifelink.donor.ConsentRepository;
import com.lifelink.donor.DonationController;
import com.lifelink.donor.DonationRepository;
import com.lifelink.donor.DonationService;
import com.lifelink.donor.DonorProfileRepository;
import com.lifelink.donor.ScreeningRepository;
import com.lifelink.donor.dto.DonationDtos.RejectRequest;
import com.lifelink.emergency.EmergencyRequestController;
import com.lifelink.emergency.EmergencyRequestRepository;
import com.lifelink.emergency.EmergencyRequestService;
import com.lifelink.emergency.RequestEventRepository;
import com.lifelink.emergency.dto.RequestDtos.PriorityRequest;
import com.lifelink.emergency.dto.RequestDtos.ReasonRequest;
import com.lifelink.identity.OrganizationMembershipRepository;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.identity.UserRepository;
import com.lifelink.inventory.InventoryService;
import com.lifelink.notification.NotificationService;
import com.lifelink.organization.OrganizationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

class NullReasonAndPriorityValidationTest {

    @Test
    void controllersRejectBlankReasonsAndMissingPriorityWithoutCallingServices() throws Exception {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        EmergencyRequestService requestService = mock(EmergencyRequestService.class);
        DonationService donationService = mock(DonationService.class);
        MockMvc requestMvc = mvc(new EmergencyRequestController(requestService), validator);
        MockMvc donationMvc = mvc(new DonationController(donationService), validator);

        for (String body : new String[]{"{}", "{\"reason\":null}", "{\"reason\":\"  \"}"}) {
            requestMvc.perform(post("/api/v1/emergency-requests/7/reject")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
            requestMvc.perform(post("/api/v1/emergency-requests/7/cancel")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
            donationMvc.perform(post("/api/v1/donations/7/reject")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        }

        requestMvc.perform(patch("/api/v1/emergency-requests/7/priority")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"priority\":null}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(requestService, donationService);
    }

    @Test
    void emergencyServiceRejectsNullReasonAndPriorityBeforeAnyAuditOrMutation() {
        EmergencyRequestRepository repository = mock(EmergencyRequestRepository.class);
        RequestEventRepository events = mock(RequestEventRepository.class);
        AuditService audits = mock(AuditService.class);
        EmergencyRequestService service = new EmergencyRequestService(repository, events,
                mock(OrganizationRepository.class), mock(TenantAccessService.class), audits,
                mock(NotificationService.class), mock(com.lifelink.reservation.ReservationService.class),
                mock(EmergencyRequestService.LifecycleBatches.class));

        assertValidationError(() -> service.reject(1L, new ReasonRequest(null)));
        assertValidationError(() -> service.cancel(1L, new ReasonRequest(" ")));
        assertValidationError(() -> service.changePriority(1L, new PriorityRequest(null)));

        verifyNoInteractions(repository, events, audits);
    }

    @Test
    void donationServiceRejectsNullReasonBeforeAnyAuditOrMutation() {
        DonationRepository repository = mock(DonationRepository.class);
        AuditService audits = mock(AuditService.class);
        DonationService service = new DonationService(repository, mock(DonorProfileRepository.class),
                mock(AppointmentRepository.class), mock(ScreeningRepository.class),
                mock(OrganizationRepository.class), mock(UserRepository.class),
                mock(OrganizationMembershipRepository.class), mock(InventoryService.class),
                mock(TenantAccessService.class), audits);

        assertValidationError(() -> service.reject(1L, new RejectRequest(null)));

        verifyNoInteractions(repository, audits);
    }

    private void assertValidationError(Runnable action) {
        ValidationException failure = assertThrows(ValidationException.class, action::run);
        assertEquals(ErrorCode.VALIDATION_ERROR, failure.errorCode());
    }

    private MockMvc mvc(Object controller, LocalValidatorFactoryBean validator) {
        return MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();
    }
}
