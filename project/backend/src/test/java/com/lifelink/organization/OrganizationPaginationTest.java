package com.lifelink.organization;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import com.lifelink.organization.dto.OrganizationDtos.View;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(properties = {"lifelink.seed.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:lifelink-organization-pagination;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;DEFAULT_NULL_ORDERING=HIGH"})
@ActiveProfiles("test")
class OrganizationPaginationTest {
    @Autowired
    private OrganizationService service;
    @Autowired
    private OrganizationRepository repository;

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void nonAdminPagesAreDatabasePagedAndDisjoint() {
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        for (int i = 0; i < 3; i++) {
            String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            Organization org = repository.save(new Organization("Page Org " + suffix,
                    Organization.Type.HOSPITAL, "PAGE-" + suffix, "City", "State",
                    suffix.toLowerCase() + "@example.test", null, "Area"));
            ids.add(org.getId());
        }
        AuthenticatedUser user = new AuthenticatedUser(10L, "paged@test", "Paged User",
                EnumSet.of(Role.HOSPITAL_ADMIN), EnumSet.of(Permission.ORGANIZATION_READ), ids, Set.of());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));

        Page<View> first = service.list(PageRequest.of(0, 2, Sort.by("id")));
        Page<View> second = service.list(PageRequest.of(1, 2, Sort.by("id")));

        assertEquals(3, first.getTotalElements());
        assertEquals(2, first.getTotalPages());
        assertEquals(2, first.getContent().size());
        assertEquals(1, second.getContent().size());
        assertEquals(0, first.getNumber());
        assertEquals(1, second.getNumber());
        Set<Long> firstIds = first.getContent().stream().map(View::id).collect(Collectors.toSet());
        Set<Long> secondIds = second.getContent().stream().map(View::id).collect(Collectors.toSet());
        assertTrue(firstIds.stream().noneMatch(secondIds::contains));
        LinkedHashSet<Long> pagedIds = new LinkedHashSet<>();
        first.getContent().stream().map(View::id).forEach(pagedIds::add);
        second.getContent().stream().map(View::id).forEach(pagedIds::add);
        assertEquals(ids, pagedIds);
    }
}
