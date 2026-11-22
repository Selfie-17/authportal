# syntax=docker/dockerfile:1

FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /build

COPY pom.xml ./
COPY src/main/ ./src/main/
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    mvn -B -ntp -Dmaven.test.skip=true package \
    && cp target/*.jar app.jar \
    && java -Djarmode=tools -jar app.jar extract --layers --destination extracted

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Keep the local storage path available for deployments that use it.
RUN mkdir -p /app/storage

# Keep application code separate so unchanged dependency layers can be reused.
COPY --from=build /build/extracted/dependencies/ ./
COPY --from=build /build/extracted/spring-boot-loader/ ./
COPY --from=build /build/extracted/snapshot-dependencies/ ./
COPY --from=build /build/extracted/application/ ./

EXPOSE 8080
ENV PORT=8080
ENV JAVA_OPTS="-XX:+UseSerialGC -Xms128m -Xmx256m -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=48m -Xss512k -Dfile.encoding=UTF-8 -Djava.security.egd=file:/dev/./urandom"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
