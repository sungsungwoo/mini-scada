FROM eclipse-temurin:17-jdk

WORKDIR /app

COPY .mvn .mvn
COPY mvnw mvnw.cmd pom.xml ./
RUN chmod +x ./mvnw

COPY src ./src

EXPOSE 8080

CMD ["./mvnw", "spring-boot:run"]