package com.lifelink.donor;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.lifelink.common.BloodGroup;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

class DonorControllerPagingTest {
    @Test
    void capsRequestedPageSizeAndUsesStableSafeSort() {
        DonorService service = mock(DonorService.class);
        DonorController controller = new DonorController(service);
        Pageable untrusted = PageRequest.of(3, 500, Sort.by("user.email"));

        controller.list("x", BloodGroup.O_POSITIVE, DonorProfile.Availability.AVAILABLE,
                "Hyderabad", "Telangana", untrusted);

        verify(service).list("x", BloodGroup.O_POSITIVE, DonorProfile.Availability.AVAILABLE,
                "Hyderabad", "Telangana",
                PageRequest.of(3, 100, Sort.by(Sort.Direction.ASC, "id")));
    }

    @Test
    void enforcesPositivePageSize() {
        DonorService service = mock(DonorService.class);
        DonorController controller = new DonorController(service);

        controller.list(null, null, null, null, null, PageRequest.of(0, 1));

        verify(service).list(null, null, null, null, null,
                PageRequest.of(0, 1, Sort.by(Sort.Direction.ASC, "id")));
    }
}
