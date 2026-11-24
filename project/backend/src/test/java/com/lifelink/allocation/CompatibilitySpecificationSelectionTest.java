package com.lifelink.allocation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class CompatibilitySpecificationSelectionTest {
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(StrictSameGroupSpecification.class,
                    ConfiguredCompatibilitySpecification.class);

    @Test
    void defaultAndStrictModeExposeOnlyTheStrictRule() {
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(CompatibilitySpecification.class);
            assertThat(context.getBean(CompatibilitySpecification.class))
                    .isInstanceOf(StrictSameGroupSpecification.class);
        });
        contextRunner.withPropertyValues("lifelink.allocation.compatibility-mode=STRICT_SAME_GROUP")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(CompatibilitySpecification.class);
                    assertThat(context.getBean(CompatibilitySpecification.class))
                            .isInstanceOf(StrictSameGroupSpecification.class);
                });
    }

    @Test
    void configuredModeExposesOnlyTheConfiguredRule() {
        contextRunner.withPropertyValues("lifelink.allocation.compatibility-mode=CONFIGURED")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(CompatibilitySpecification.class);
                    assertThat(context.getBean(CompatibilitySpecification.class))
                            .isInstanceOf(ConfiguredCompatibilitySpecification.class);
                });
    }
}
