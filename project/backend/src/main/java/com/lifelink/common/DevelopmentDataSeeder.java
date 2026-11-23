package com.lifelink.common;

import com.lifelink.donor.Donation;
import com.lifelink.donor.DonorProfile;
import com.lifelink.donor.DonorProfileRepository;
import com.lifelink.donor.DonationRepository;
import com.lifelink.donor.ScreeningRecord;
import com.lifelink.donor.ScreeningRepository;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.emergency.EmergencyRequestRepository;
import com.lifelink.emergency.RequestEvent;
import com.lifelink.emergency.RequestEventRepository;
import com.lifelink.identity.OrganizationMembership;
import com.lifelink.identity.OrganizationMembershipRepository;
import com.lifelink.identity.Role;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.BloodUnitRepository;
import com.lifelink.notification.Notification;
import com.lifelink.notification.NotificationRepository;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile({"dev", "default", "postgres", "postgres-it"})
@ConditionalOnProperty(prefix = "lifelink.seed", name = "enabled", havingValue = "true")
public class DevelopmentDataSeeder implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DevelopmentDataSeeder.class);

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final DonorProfileRepository donorRepository;
    private final DonationRepository donationRepository;
    private final ScreeningRepository screeningRepository;
    private final BloodUnitRepository unitRepository;
    private final EmergencyRequestRepository requestRepository;
    private final RequestEventRepository eventRepository;
    private final NotificationRepository notificationRepository;
    private final PasswordEncoder passwordEncoder;

    public DevelopmentDataSeeder(OrganizationRepository organizationRepository,
                                 UserRepository userRepository,
                                 OrganizationMembershipRepository membershipRepository,
                                 DonorProfileRepository donorRepository,
                                 DonationRepository donationRepository,
                                 ScreeningRepository screeningRepository,
                                 BloodUnitRepository unitRepository,
                                 EmergencyRequestRepository requestRepository,
                                 RequestEventRepository eventRepository,
                                 NotificationRepository notificationRepository,
                                 PasswordEncoder passwordEncoder) {
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.donorRepository = donorRepository;
        this.donationRepository = donationRepository;
        this.screeningRepository = screeningRepository;
        this.unitRepository = unitRepository;
        this.requestRepository = requestRepository;
        this.eventRepository = eventRepository;
        this.notificationRepository = notificationRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.existsByEmail("admin@lifelink.local")) {
            log.info("Development seed data already present; skipping");
            return;
        }
        Organization bank = organizationRepository.save(new Organization(
                "Central Blood Bank", Organization.Type.BLOOD_BANK, "BB-HYD-001",
                "Hyderabad", "Telangana", "bank@lifelink.local", "+914012345678", "Hyderabad metropolitan area"));
        bank.verify();
        Organization hospital = organizationRepository.save(new Organization(
                "LifeCare General Hospital", Organization.Type.HOSPITAL, "HOS-HYD-001",
                "Hyderabad", "Telangana", "hospital@lifelink.local", "+914012345679", "Hyderabad metropolitan area"));
        hospital.verify();

        User admin = user("admin@lifelink.local", "Admin@123!", "Platform Administrator", Set.of(Role.PLATFORM_ADMIN));
        User bankAdmin = user("bank@lifelink.local", "Bank@123!", "Blood Bank Administrator",
                Set.of(Role.BLOOD_BANK_ADMIN));
        User inventory = user("inventory@lifelink.local", "Inventory@123!", "Inventory Manager",
                Set.of(Role.INVENTORY_MANAGER));
        User hospitalAdmin = user("hospital@lifelink.local", "Hospital@123!", "Hospital Administrator",
                Set.of(Role.HOSPITAL_ADMIN));
        User medical = user("medical@lifelink.local", "Medical@123!", "Medical Staff", Set.of(Role.MEDICAL_STAFF));
        User donorUser = user("donor@lifelink.local", "Donor@123!", "Demo Donor", Set.of(Role.DONOR));

        member(bankAdmin, bank, Role.BLOOD_BANK_ADMIN);
        member(inventory, bank, Role.INVENTORY_MANAGER);
        member(hospitalAdmin, hospital, Role.HOSPITAL_ADMIN);
        member(medical, hospital, Role.MEDICAL_STAFF);

        DonorProfile donor = donorRepository.save(new DonorProfile(donorUser,
                com.lifelink.common.BloodGroup.O_POSITIVE,
                java.time.LocalDate.of(1995, 5, 14), "12 Demo Street", "Hyderabad", "Telangana", "IN_APP"));
        Donation donation = donationRepository.save(new Donation(donor, bank, null,
                Instant.now().minus(2, ChronoUnit.DAYS), "Demo donation"));
        donation.screen(true);
        donation.approve();
        screeningRepository.save(new ScreeningRecord(donation, true, "Demo screening passed", bankAdmin));

        Instant collected = Instant.now().minus(2, ChronoUnit.DAYS);
        for (int index = 0; index < 6; index++) {
            BloodUnit unit = new BloodUnit("LL-WB-" + (1000 + index),
                    com.lifelink.common.BloodGroup.O_POSITIVE,
                    com.lifelink.common.ComponentType.WHOLE_BLOOD,
                    collected, collected.plus(35, ChronoUnit.DAYS), "COLD-ROOM-A", bank, donation);
            if (index < 4) {
                unit.release(Instant.now());
            }
            unitRepository.save(unit);
        }
        for (int index = 0; index < 3; index++) {
            BloodUnit unit = new BloodUnit("LL-RC-" + (2000 + index),
                    com.lifelink.common.BloodGroup.A_POSITIVE,
                    com.lifelink.common.ComponentType.RED_CELLS,
                    collected, collected.plus(42, ChronoUnit.DAYS), "COLD-ROOM-B", bank, null);
            unit.release(Instant.now());
            unitRepository.save(unit);
        }

        EmergencyRequest request = new EmergencyRequest("LL-ER-DEMO-0001", hospital, "PATIENT-REF-001",
                com.lifelink.common.BloodGroup.O_POSITIVE, com.lifelink.common.ComponentType.WHOLE_BLOOD,
                2, EmergencyRequest.Priority.URGENT, Instant.now().plus(12, ChronoUnit.HOURS),
                "Demo emergency request; clinical details entered by authorized staff", hospitalAdmin.getId());
        request.verify(bankAdmin.getId());
        request.approve(bankAdmin.getId());
        requestRepository.save(request);
        eventRepository.save(new RequestEvent(request, "CREATED", "Seeded demo request", hospitalAdmin.getId()));
        eventRepository.save(new RequestEvent(request, "VERIFIED", "Verified by blood bank", bankAdmin.getId()));
        eventRepository.save(new RequestEvent(request, "APPROVED", "Approved for allocation review", bankAdmin.getId()));

        notificationRepository.save(new Notification(bankAdmin, "Seed data ready",
                "Development demo data has been loaded", "SYSTEM", Notification.Channel.IN_APP));
        notificationRepository.save(new Notification(hospitalAdmin, "Request ready",
                "LL-ER-DEMO-0001 is awaiting allocation review", "REQUEST_CREATED", Notification.Channel.IN_APP));
        log.info("Development seed data created: 2 organizations, 6 users, 9 blood units, 1 request");
    }

    private User user(String email, String password, String fullName, Set<Role> roles) {
        return userRepository.save(new User(email, passwordEncoder.encode(password), fullName,
                "+910000000000", User.Status.ACTIVE, roles));
    }

    private void member(User user, Organization organization, Role role) {
        membershipRepository.save(new OrganizationMembership(user, organization, role));
    }
}
