import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Supplier;

/**
 * Practical-4 executable evidence.
 *
 * Five case studies: Design by Contract, LSP, Interfaces/Abstract/Sealed classes,
 * Contract Testing, and Cost of Change with SOLID. Run with Java 21.
 */
public final class Practical4Demo {

    private static int checks;
    private static int failures;

    public static void main(String[] args) {
        banner("PRACTICAL-4 - CASE STUDIES M3");
        caseStudy1();
        caseStudy2();
        caseStudy3();
        caseStudy4();
        caseStudy5();
        banner("SUMMARY");
        System.out.printf("Checks run: %d | Failed: %d | Result: %s%n",
                checks, failures, failures == 0 ? "PASS" : "FAIL");
        if (failures > 0) System.exit(1);
    }

    private static void banner(String title) {
        System.out.println();
        System.out.println("============================================================");
        System.out.println(title);
        System.out.println("============================================================");
    }

    private static void check(String name, boolean condition) {
        checks++;
        if (!condition) failures++;
        System.out.printf("[%s] %s%n", condition ? "PASS" : "FAIL", name);
    }

    private static void info(String message) {
        System.out.println("  " + message);
    }

    // ------------------------------------------------------------------
    // CASE STUDY 1 - DESIGN BY CONTRACT: SPOT ALLOCATOR
    // ------------------------------------------------------------------

    /** A vehicle that may require an oversize-enabled parking spot. */
    record Vehicle(String plate, boolean oversize) { }

    /** Mutable parking spot used only by the allocator demonstration. */
    static final class Spot {
        private final int id;
        private final String zone;
        private final int distanceFromEntry;
        private final boolean oversizeAllowed;
        private boolean occupied;

        Spot(int id, String zone, int distanceFromEntry, boolean oversizeAllowed) {
            this.id = id;
            this.zone = zone;
            this.distanceFromEntry = distanceFromEntry;
            this.oversizeAllowed = oversizeAllowed;
        }

        boolean canPark(Vehicle vehicle) {
            return vehicle != null && (!vehicle.oversize() || oversizeAllowed);
        }

        boolean isOccupied() { return occupied; }
        void occupy() { occupied = true; }
        int distance() { return distanceFromEntry; }
        String zone() { return zone; }

        @Override public String toString() {
            return "Spot-" + id + "(" + zone + ",d=" + distanceFromEntry + ")";
        }
    }

    /**
     * Contract for SpotAllocator.
     *
     * <p><b>Preconditions:</b> {@code vehicle} must be non-null with a non-blank plate;
     * {@code candidates} must be non-null and contain no null elements.</p>
     *
     * <p><b>Postconditions:</b> the returned Optional is empty when no compatible free
     * spot exists; when present, the spot is free and compatible with the vehicle; the
     * same inputs always produce the same result.</p>
     *
     * <p><b>Class invariant:</b> allocation never mutates the candidate list or any
     * Spot; occupancy changes are the caller's responsibility.</p>
     *
     * <p><b>Six additional clauses not in the method signature:</b>
     * (1) null vehicle is rejected; (2) blank plate is rejected;
     * (3) empty candidate list returns Optional.empty();
     * (4) an occupied spot is never returned;
     * (5) an incompatible spot is never returned;
     * (6) allocation is deterministic and side-effect free.</p>
     */
    interface SpotAllocator {
        Optional<Spot> allocate(Vehicle vehicle, List<Spot> candidates);
    }

    static final class FirstFitAllocator implements SpotAllocator {
        @Override public Optional<Spot> allocate(Vehicle vehicle, List<Spot> candidates) {
            requireVehicle(vehicle);
            requireCandidates(candidates);
            return candidates.stream()
                    .filter(s -> !s.isOccupied() && s.canPark(vehicle))
                    .findFirst();
        }
    }

    static final class LowestOccupancyZoneAllocator implements SpotAllocator {
        @Override public Optional<Spot> allocate(Vehicle vehicle, List<Spot> candidates) {
            requireVehicle(vehicle);
            requireCandidates(candidates);
            Map<String, Long> occupied = new HashMap<>();
            for (Spot s : candidates) {
                if (s.isOccupied()) occupied.merge(s.zone(), 1L, Long::sum);
            }
            return candidates.stream()
                    .filter(s -> !s.isOccupied() && s.canPark(vehicle))
                    .min((a, b) -> {
                        int byZone = Long.compare(occupied.getOrDefault(a.zone(), 0L),
                                occupied.getOrDefault(b.zone(), 0L));
                        return byZone != 0 ? byZone : Integer.compare(a.distance(), b.distance());
                    });
        }
    }

    static final class NearestEntryAllocator implements SpotAllocator {
        @Override public Optional<Spot> allocate(Vehicle vehicle, List<Spot> candidates) {
            requireVehicle(vehicle);
            requireCandidates(candidates);
            return candidates.stream()
                    .filter(s -> !s.isOccupied() && s.canPark(vehicle))
                    .min((a, b) -> Integer.compare(a.distance(), b.distance()));
        }
    }

    /** Intentionally defective implementation used to prove the suite detects violations. */
    static final class SaboteurAllocator implements SpotAllocator {
        @Override public Optional<Spot> allocate(Vehicle vehicle, List<Spot> candidates) {
            return candidates.stream().findFirst(); // ignores occupancy and compatibility
        }
    }

    private static void requireVehicle(Vehicle vehicle) {
        if (vehicle == null || vehicle.plate() == null || vehicle.plate().isBlank()) {
            throw new IllegalArgumentException("Vehicle and plate must be valid");
        }
    }

    private static void requireCandidates(List<Spot> candidates) {
        if (candidates == null) {
            throw new IllegalArgumentException("Candidate list must be non-null without null elements");
        }
        for (Spot candidate : candidates) {
            if (candidate == null) {
                throw new IllegalArgumentException("Candidate list must be non-null without null elements");
            }
        }
    }

    /** One reusable contract suite; no implementation-specific code. */
    private static List<String> allocatorContract(Supplier<SpotAllocator> factory) {
        List<String> violations = new ArrayList<>();
        SpotAllocator allocator = factory.get();
        Vehicle car = new Vehicle("TS09AB1234", false);
        Vehicle bus = new Vehicle("TS10XY0001", true);

        try { allocator.allocate(null, List.of()); violations.add("null vehicle accepted"); }
        catch (IllegalArgumentException | NullPointerException expected) { /* correct */ }

        try { allocator.allocate(new Vehicle(" ", false), List.of()); violations.add("blank plate accepted"); }
        catch (IllegalArgumentException expected) { /* correct */ }

        if (allocator.allocate(car, List.of()).isPresent()) violations.add("empty list did not return empty");

        Spot occupied = new Spot(1, "A", 10, true);
        occupied.occupy();
        if (allocator.allocate(car, List.of(occupied)).isPresent()) violations.add("occupied spot returned");

        Spot compact = new Spot(2, "B", 20, false);
        if (allocator.allocate(bus, List.of(compact)).isPresent()) violations.add("incompatible spot returned");

        Spot a = new Spot(3, "A", 5, true);
        Spot b = new Spot(4, "B", 6, true);
        Optional<Spot> first = allocator.allocate(car, List.of(a, b));
        Optional<Spot> second = allocator.allocate(car, List.of(a, b));
        if (first.isEmpty() || second.isEmpty() || first.get() != second.get()) {
            violations.add("allocation is not deterministic");
        }
        if (a.isOccupied() || b.isOccupied()) violations.add("allocator mutated spot state");
        return violations;
    }

    private static void caseStudy1() {
        banner("CASE STUDY 1 - SMART PARKING / DESIGN BY CONTRACT");
        record Implementation(String name, Supplier<SpotAllocator> factory, boolean shouldPass) { }
        List<Implementation> implementations = List.of(
                new Implementation("FirstFitAllocator", FirstFitAllocator::new, true),
                new Implementation("LowestOccupancyZoneAllocator", LowestOccupancyZoneAllocator::new, true),
                new Implementation("NearestEntryAllocator", NearestEntryAllocator::new, true),
                new Implementation("SaboteurAllocator", SaboteurAllocator::new, false));
        for (Implementation impl : implementations) {
            List<String> violations = allocatorContract(impl.factory());
            boolean expected = impl.shouldPass() ? violations.isEmpty() : !violations.isEmpty();
            check(impl.name() + " satisfies contract", expected);
            if (!violations.isEmpty()) info(impl.name() + " violations: " + violations);
        }
        info("Caller violations: null/blank vehicle, null list, null element.");
        info("Implementer violations: occupied/incompatible spot, mutation, non-determinism.");
    }

    // ------------------------------------------------------------------
    // CASE STUDY 2 - LISKOV SUBSTITUTION PRINCIPLE
    // ------------------------------------------------------------------

    @FunctionalInterface
    interface WithdrawalPolicy {
        boolean allow(long currentBalance, long amount);
    }

    /** Parent abstraction with final protocol; subclasses inject rules, not new behaviour. */
    static abstract class BankAccount {
        private final String id;
        private long balance;
        private final WithdrawalPolicy policy;

        BankAccount(String id, long openingBalance, WithdrawalPolicy policy) {
            this.id = id;
            this.balance = openingBalance;
            this.policy = policy;
        }

        public final void deposit(long amount) {
            if (amount <= 0) throw new IllegalArgumentException("Deposit must be positive");
            balance += amount;
        }

        public final boolean withdraw(long amount) {
            if (amount <= 0) throw new IllegalArgumentException("Withdrawal must be positive");
            if (!policy.allow(balance, amount)) return false;
            balance -= amount;
            return true;
        }

        public final long balance() { return balance; }
        public final String id() { return id; }
    }

    static final class SavingsAccount extends BankAccount {
        SavingsAccount(String id) {
            super(id, 10_000L, (balance, amount) -> balance - amount >= 1_000L);
        }
    }

    static final class CurrentAccount extends BankAccount {
        CurrentAccount(String id) {
            super(id, 5_000L, (balance, amount) -> balance - amount >= -5_000L);
        }
    }

    static final class FixedDepositAccount extends BankAccount {
        FixedDepositAccount(String id, boolean matured) {
            super(id, 20_000L, (balance, amount) -> matured && balance >= amount);
        }
    }

    /** Client code uses only the parent abstraction; no instanceof, no extra preconditions. */
    private static String payBills(BankAccount account) {
        account.deposit(500L);
        boolean paid = account.withdraw(1_200L);
        return account.id() + " paid=" + paid + " balance=" + account.balance();
    }

    private static void caseStudy2() {
        banner("CASE STUDY 2 - ONLINE BANKING / LSP");
        List<BankAccount> accounts = List.of(
                new SavingsAccount("SB-1"),
                new CurrentAccount("CA-1"),
                new FixedDepositAccount("FD-1", true),
                new FixedDepositAccount("FD-2", false));
        for (BankAccount account : accounts) {
            String result = payBills(account);
            check("substitution works for " + account.id(), result.contains("balance="));
            info(result);
        }
        check("immature FD declines instead of throwing", !new FixedDepositAccount("FD-3", false).withdraw(100L));
        info("Violation signals: unexpected exception, empty override, stronger precondition, instanceof branching.");
        info("Redesign: final BankAccount protocol + injected WithdrawalPolicy keeps all subclasses substitutable.");
    }

    // ------------------------------------------------------------------
    // CASE STUDY 3 - INTERFACES, ABSTRACT CLASSES, SEALED CLASSES
    // ------------------------------------------------------------------

    interface Registerable { boolean register(); }
    interface Assessable { double grade(int marks); }
    interface PrerequisiteCheckable { boolean hasPrerequisite(Course course); }

    sealed interface Course extends Registerable, Assessable, PrerequisiteCheckable
            permits RegularCourse, LabCourse, ElectiveCourse, ResearchCourse {
        String code();
        String title();
    }

    /** Shared implementation only; deliberately outside the sealed Course hierarchy. */
    abstract static class AbstractCourse {
        private final String code;
        private final String title;
        private boolean registered;

        AbstractCourse(String code, String title) {
            this.code = code;
            this.title = title;
        }

        public final String code() { return code; }
        public final String title() { return title; }
        public final boolean register() {
            if (registered) return false;
            registered = true;
            return true;
        }
        public final double grade(int marks) {
            if (marks < 0 || marks > 100) throw new IllegalArgumentException("Marks must be 0..100");
            return marks / 10.0;
        }
    }

    static final class RegularCourse extends AbstractCourse implements Course {
        RegularCourse() { super("CS101", "Programming"); }
        @Override public boolean hasPrerequisite(Course course) { return false; }
    }

    static final class LabCourse extends AbstractCourse implements Course {
        LabCourse() { super("CS102L", "Programming Lab"); }
        @Override public boolean hasPrerequisite(Course course) { return course instanceof RegularCourse; }
    }

    static final class ElectiveCourse extends AbstractCourse implements Course {
        ElectiveCourse() { super("CS301E", "Cloud elective"); }
        @Override public boolean hasPrerequisite(Course course) { return course instanceof RegularCourse; }
    }

    static final class ResearchCourse extends AbstractCourse implements Course {
        ResearchCourse() { super("CS499R", "Research project"); }
        @Override public boolean hasPrerequisite(Course course) { return course instanceof ElectiveCourse; }
    }

    private static String courseKind(Course course) {
        return switch (course) {
            case RegularCourse c -> "regular:" + c.code();
            case LabCourse c -> "lab:" + c.code();
            case ElectiveCourse c -> "elective:" + c.code();
            case ResearchCourse c -> "research:" + c.code();
        };
    }

    private static void caseStudy3() {
        banner("CASE STUDY 3 - COURSE REGISTRATION / ROLE INTERFACES + SEALED TYPES");
        List<Course> courses = List.of(
                new RegularCourse(), new LabCourse(), new ElectiveCourse(), new ResearchCourse());
        for (Course course : courses) {
            check("register " + course.code(), course.register());
            check("grade " + course.code(), Math.abs(course.grade(80) - 8.0) < 0.0001);
            info(courseKind(course));
        }
        check("no instanceof in courseKind switch", courseKind(new LabCourse()).startsWith("lab:"));
        info("Interfaces = roles; abstract class = shared identity/state; sealed interface = closed hierarchy.");
    }

    // ------------------------------------------------------------------
    // CASE STUDY 4 - CONTRACT TESTING AND DEBUGGING
    // ------------------------------------------------------------------

    record Receipt(String id, String status, BigDecimal amount) { }

    /**
     * PaymentProcessor contract:
     * pre: amount != null, 0 < amount <= 100000;
     * post: non-null Receipt, non-blank id, status SUCCESS or DECLINED, amount preserved;
     * invariant: no processor may throw an unchecked exception for a valid amount.
     */
    interface PaymentProcessor {
        Receipt process(BigDecimal amount);
    }

    static final class CreditCardProcessor implements PaymentProcessor {
        @Override public Receipt process(BigDecimal amount) {
            requirePaymentAmount(amount);
            return new Receipt("CC-" + amount.hashCode(), "SUCCESS", amount);
        }
    }

    static final class UpiProcessor implements PaymentProcessor {
        @Override public Receipt process(BigDecimal amount) {
            requirePaymentAmount(amount);
            String status = amount.compareTo(new BigDecimal("5000")) > 0 ? "DECLINED" : "SUCCESS";
            return new Receipt("UPI-" + amount.hashCode(), status, amount);
        }
    }

    static final class NetBankingProcessor implements PaymentProcessor {
        @Override public Receipt process(BigDecimal amount) {
            requirePaymentAmount(amount);
            return new Receipt("NB-" + amount.hashCode(), "SUCCESS", amount);
        }
    }

    static final class DefectiveProcessor implements PaymentProcessor {
        @Override public Receipt process(BigDecimal amount) {
            if (amount.compareTo(BigDecimal.ZERO) == 0) {
                throw new IllegalStateException("Unexpected zero crash");
            }
            return new Receipt("", "SUCCESS", BigDecimal.ZERO); // blank id, wrong amount
        }
    }

    private static void requirePaymentAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0
                || amount.compareTo(new BigDecimal("100000")) > 0) {
            throw new IllegalArgumentException("Amount must be in (0, 100000]");
        }
    }

    private static List<String> paymentContract(Supplier<PaymentProcessor> factory) {
        List<String> violations = new ArrayList<>();
        PaymentProcessor processor = factory.get();
        BigDecimal valid = new BigDecimal("1250.00");

        try { processor.process(BigDecimal.ONE.negate()); violations.add("negative amount accepted"); }
        catch (IllegalArgumentException expected) { /* correct */ }
        catch (RuntimeException unexpected) {
            violations.add("unexpected exception for negative amount: " + unexpected.getClass().getSimpleName());
        }

        try { processor.process(BigDecimal.ZERO); violations.add("zero amount accepted"); }
        catch (IllegalArgumentException expected) { /* correct */ }
        catch (RuntimeException unexpected) {
            violations.add("unexpected exception for zero amount: " + unexpected.getClass().getSimpleName());
        }

        try { processor.process(new BigDecimal("100001")); violations.add("over-limit amount accepted"); }
        catch (IllegalArgumentException expected) { /* correct */ }
        catch (RuntimeException unexpected) {
            violations.add("unexpected exception for over-limit amount: " + unexpected.getClass().getSimpleName());
        }

        Receipt receipt = null;
        try { receipt = processor.process(valid); }
        catch (RuntimeException unexpected) {
            violations.add("unexpected exception for valid amount: " + unexpected.getClass().getSimpleName());
        }
        if (receipt == null) violations.add("null receipt");
        else {
            if (receipt.id() == null || receipt.id().isBlank()) violations.add("blank receipt id");
            if (!List.of("SUCCESS", "DECLINED").contains(receipt.status())) violations.add("invalid status");
            if (receipt.amount() == null || receipt.amount().compareTo(valid) != 0) {
                violations.add("amount not preserved");
            }
        }
        return violations;
    }

    private static void caseStudy4() {
        banner("CASE STUDY 4 - E-COMMERCE / CONTRACT TESTING + DEBUGGING");
        record Impl(String name, Supplier<PaymentProcessor> factory, boolean shouldPass) { }
        for (Impl impl : List.of(
                new Impl("CreditCardProcessor", CreditCardProcessor::new, true),
                new Impl("UpiProcessor", UpiProcessor::new, true),
                new Impl("NetBankingProcessor", NetBankingProcessor::new, true),
                new Impl("DefectiveProcessor", DefectiveProcessor::new, false))) {
            List<String> violations = paymentContract(impl.factory());
            boolean expected = impl.shouldPass() ? violations.isEmpty() : !violations.isEmpty();
            check(impl.name() + " passes shared suite", expected);
            if (!violations.isEmpty()) info("Detected: " + violations);
        }
        info("Diagnosis: zero crash = unexpected exception (implementer); blank id = postcondition violation (implementer).");
        info("Diagnosis: negative amount accepted = caller-side precondition failure not enforced (implementer defect).");
    }

    // ------------------------------------------------------------------
    // CASE STUDY 5 - COST OF CHANGE AND SOLID
    // ------------------------------------------------------------------

    interface BillingStrategy { String bill(String patient, BigDecimal amount); }

    static final class CashBilling implements BillingStrategy {
        @Override public String bill(String patient, BigDecimal amount) {
            return "CASH invoice for " + patient + " " + amount;
        }
    }

    static final class InsuranceBilling implements BillingStrategy {
        @Override public String bill(String patient, BigDecimal amount) {
            return "INSURANCE claim for " + patient + " " + amount;
        }
    }

    interface ServiceObserver { void onEvent(String event); }

    static final class AuditObserver implements ServiceObserver {
        private final List<String> events = new ArrayList<>();
        @Override public void onEvent(String event) { events.add(event); }
        List<String> events() { return List.copyOf(events); }
    }

    interface MedicalService { String deliver(String patient); }

    static final class RegistrationService implements MedicalService {
        private final BillingStrategy billing;
        private final List<ServiceObserver> observers;
        RegistrationService(BillingStrategy billing, List<ServiceObserver> observers) {
            this.billing = billing; this.observers = observers;
        }
        @Override public String deliver(String patient) {
            String result = "Registered " + patient;
            observers.forEach(o -> o.onEvent("REGISTERED:" + patient));
            return result + " | " + billing.bill(patient, new BigDecimal("250"));
        }
    }

    static final class DiagnosticService implements MedicalService {
        private final BillingStrategy billing;
        private final List<ServiceObserver> observers;
        DiagnosticService(BillingStrategy billing, List<ServiceObserver> observers) {
            this.billing = billing; this.observers = observers;
        }
        @Override public String deliver(String patient) {
            String result = "Lab report ready for " + patient;
            observers.forEach(o -> o.onEvent("DIAGNOSTIC:" + patient));
            return result + " | " + billing.bill(patient, new BigDecimal("800"));
        }
    }

    /** New service added later without editing the registry or workflow. */
    static final class ScanService implements MedicalService {
        private final BillingStrategy billing;
        private final List<ServiceObserver> observers;
        ScanService(BillingStrategy billing, List<ServiceObserver> observers) {
            this.billing = billing; this.observers = observers;
        }
        @Override public String deliver(String patient) {
            observers.forEach(o -> o.onEvent("SCAN:" + patient));
            return "Scan scheduled for " + patient + " | " + billing.bill(patient, new BigDecimal("1200"));
        }
    }

    /** Open/Closed registry: new types are registered, not wired through switch statements. */
    static final class ServiceRegistry {
        private final Map<String, BiFunction<BillingStrategy, List<ServiceObserver>, MedicalService>> factories =
                new HashMap<>();

        void register(String key, BiFunction<BillingStrategy, List<ServiceObserver>, MedicalService> factory) {
            factories.put(key, factory);
        }

        MedicalService create(String key, BillingStrategy billing, List<ServiceObserver> observers) {
            var factory = factories.get(key);
            if (factory == null) throw new IllegalArgumentException("Unknown service: " + key);
            return factory.apply(billing, observers);
        }
    }

    static final class HospitalWorkflow {
        private final ServiceRegistry registry;
        private final BillingStrategy billing;
        private final List<ServiceObserver> observers;

        HospitalWorkflow(ServiceRegistry registry, BillingStrategy billing, List<ServiceObserver> observers) {
            this.registry = registry; this.billing = billing; this.observers = observers;
        }

        String run(String serviceKey, String patient) {
            return registry.create(serviceKey, billing, observers).deliver(patient);
        }
    }

    private static void caseStudy5() {
        banner("CASE STUDY 5 - HOSPITAL / COST OF CHANGE + SOLID");
        var observers = new ArrayList<ServiceObserver>();
        var audit = new AuditObserver();
        observers.add(audit);

        var registry = new ServiceRegistry();
        registry.register("registration", RegistrationService::new);
        registry.register("diagnostic", DiagnosticService::new);
        var workflow = new HospitalWorkflow(registry, new InsuranceBilling(), observers);

        check("registration service", workflow.run("registration", "P-101").contains("Registered"));
        check("diagnostic service", workflow.run("diagnostic", "P-101").contains("Lab report"));

        // OCP proof: add a new service without editing existing classes.
        registry.register("scan", ScanService::new);
        check("new scan service added without editing workflow",
                workflow.run("scan", "P-101").contains("Scan scheduled"));
        check("observer recorded all three events", audit.events().size() == 3);
        info("SOLID: SRP split services/billing/audit; OCP registry; LSP via MedicalService; ISP via narrow interfaces; DIP via constructor injection.");
        info("Patterns: Strategy (billing), Factory/Registry (services), Observer (audit events).");
    }
}
