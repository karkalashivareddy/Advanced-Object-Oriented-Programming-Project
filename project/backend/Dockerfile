# syntax=docker/dockerfile:1
# Multi-stage build for the LifeLink Spring Boot backend.
# The host JDK (e.g. Java 25) is irrelevant: we always compile and run on Java 21.

ARG JAVA_VERSION=21

FROM eclipse-temurin:${JAVA_VERSION}-jdk AS build
WORKDIR /workspace

# Maven wrapper is committed by the backend engineer; no global Maven needed.
COPY mvnw pom.xml ./
COPY .mvn ./.mvn
RUN chmod +x mvnw

COPY src ./src
RUN ./mvnw -B -DskipTests -DskipITs package \
 && cp "$(find target -maxdepth 1 -type f -name '*.jar' \
        ! -name '*sources*' ! -name '*javadoc*' | head -n 1)" /workspace/app.jar

FROM eclipse-temurin:${JAVA_VERSION}-jre-alpine
LABEL org.opencontainers.image.title="LifeLink backend" \
      org.opencontainers.image.description="Spring Boot API (Java 21 runtime)"

# Unprivileged, fixed UID/GID. No shell-based root processes at runtime.
RUN addgroup -S -g 10001 app \
 && adduser -S -u 10001 -G app app

WORKDIR /app
COPY --from=build --chown=app:app /workspace/app.jar /app/app.jar

ENV JAVA_OPTS="-Xms128m -Xmx512m" \
    SPRING_PROFILES_ACTIVE=postgres
USER app
EXPOSE 8080

# Alpine ships busybox nc, so this works without adding curl to the runtime image.
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=10 \
  CMD nc -z 127.0.0.1 8080 || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
