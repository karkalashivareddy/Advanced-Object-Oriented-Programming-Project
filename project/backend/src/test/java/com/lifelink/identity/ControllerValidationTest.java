package com.lifelink.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lifelink.allocation.AllocationController;
import com.lifelink.allocation.AllocationService;
import com.lifelink.common.GlobalExceptionHandler;
import com.lifelink.dispatch.DispatchController;
import com.lifelink.dispatch.DispatchService;
import com.lifelink.organization.OrganizationController;
import com.lifelink.organization.OrganizationService;
import com.lifelink.reservation.ReservationController;
import com.lifelink.reservation.ReservationService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

class ControllerValidationTest {
    private final AllocationService allocationService = mock(AllocationService.class);
    private final DispatchService dispatchService = mock(DispatchService.class);
    private final OrganizationService organizationService = mock(OrganizationService.class);
    private final ReservationService reservationService = mock(ReservationService.class);
    private final UserService userService = mock(UserService.class);
    private MockMvc allocationMvc;
    private MockMvc dispatchMvc;
    private MockMvc organizationMvc;
    private MockMvc reservationMvc;
    private MockMvc userMvc;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        allocationMvc = mvc(new AllocationController(allocationService), validator);
        dispatchMvc = mvc(new DispatchController(dispatchService), validator);
        organizationMvc = mvc(new OrganizationController(organizationService), validator);
        reservationMvc = mvc(new ReservationController(reservationService), validator);
        userMvc = mvc(new UserController(userService), validator);
        when(organizationService.list(any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));
    }

    @Test
    void divergentIdempotencyKeysAreRejectedAsValidationErrors() throws Exception {
        allocationMvc.perform(post("/api/v1/allocations/confirm")
                        .header("Idempotency-Key", "header-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requestId\":1,\"unitIds\":[2],\"idempotencyKey\":\"body-key\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(allocationService);
    }

    @Test
    void overlongIdempotencyHeadersAreRejectedBeforeTransactionalWork() throws Exception {
        String longKey = "x".repeat(121);

        allocationMvc.perform(post("/api/v1/allocations/confirm")
                        .header("Idempotency-Key", longKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requestId\":1,\"unitIds\":[2]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        dispatchMvc.perform(post("/api/v1/dispatches")
                        .header("Idempotency-Key", longKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reservationId\":1,\"assignedStaff\":\"nurse\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(allocationService, dispatchService);
    }

    @Test
    void overlongReservationIdempotencyKeyIsRejectedBeforeTransactionalWork() throws Exception {
        reservationMvc.perform(post("/api/v1/reservations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"unitId\":1,\"requestId\":2,\"idempotencyKey\":\"" + "x".repeat(121) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(reservationService);
    }

    @Test
    void missingRequestIdAndEmptyUnitIdsAreRejected() throws Exception {
        allocationMvc.perform(post("/api/v1/allocations/suggestions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        allocationMvc.perform(post("/api/v1/allocations/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requestId\":1,\"unitIds\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void memberRequestRequiresUserIdAndRole() throws Exception {
        organizationMvc.perform(post("/api/v1/organizations/1/members")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"DONOR\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        organizationMvc.perform(post("/api/v1/organizations/1/members")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":2}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void statusRequestRequiresStatus() throws Exception {
        userMvc.perform(patch("/api/v1/users/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void pageSizesAreCappedInOwnedListEndpoints() {
        new UserController(userService).list(null, PageRequest.of(0, 500));
        ArgumentCaptor<Pageable> userPageable = ArgumentCaptor.forClass(Pageable.class);
        verify(userService).list(isNull(), userPageable.capture());
        assertEquals(100, userPageable.getValue().getPageSize());

        new OrganizationController(organizationService).list(PageRequest.of(0, 500));
        ArgumentCaptor<Pageable> organizationPageable = ArgumentCaptor.forClass(Pageable.class);
        verify(organizationService).list(organizationPageable.capture());
        assertEquals(100, organizationPageable.getValue().getPageSize());
    }

    private MockMvc mvc(Object controller, LocalValidatorFactoryBean validator) {
        return MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();
    }
}
