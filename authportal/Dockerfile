# ==============================================================================
# Multi-stage Dockerfile for RGUKTN Auth Portal (Spring Boot 4 / Java 21)
# Optimized for Render Web Service deployment with layer caching
# ==============================================================================

# Stage 1: Build JAR
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Cache dependency layer
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Copy source and build
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Minimal JRE Runtime
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Create storage directory for student file submissions
RUN mkdir -p /app/storage

# Copy executable jar from build stage
COPY --from=build /app/target/*.jar app.jar

# Render assigns port dynamically via $PORT
EXPOSE 8080
ENV PORT=8080

# Production-tuned JVM configuration for low-memory container environments (Render Free Tier 512 MB)
# SerialGC minimizes GC thread overhead; heap, metaspace, code cache, and thread stack sizes are strictly bounded
ENV JAVA_OPTS="-XX:+UseSerialGC -Xms128m -Xmx256m -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=48m -Xss512k -Dfile.encoding=UTF-8 -Djava.security.egd=file:/dev/./urandom"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
