# Mini SCADA 개발환경 (디렉토리 구조)

## 1. 전체 디렉토리 구조 (Directory Structure)

프로젝트 루트 폴더(`mini-scada/`) 아래에 다음과 같은 구조를 구성합니다.
빈자리 문서처럼 **루트에서 인프라, 백엔드, 프론트엔드, 시뮬레이터를 함께 관리하는 형태**로 잡되, Mini SCADA 특성상 **TimescaleDB / Mosquitto / Python Simulator**를 함께 포함합니다.  

```text
mini-scada/
├── docker-compose.yml           # 전체 컨테이너 오케스트레이션 설정
├── .env                         # 환경 변수 (DB 접속정보, JWT 시크릿, MQTT 설정 등)
├── .gitignore                   # Git 업로드 제외 파일 목록
├── .vscode/                     # VS Code 환경 설정 ⭐️
│   └── mini-scada.code-workspace # 프론트/백엔드/시뮬레이터 개별 작업 공간 분리 ⭐️
│
├── backend/                     # Spring Boot 프로젝트 (Maven)
│   ├── Dockerfile               # 백엔드용 도커 이미지 빌드 파일
│   ├── pom.xml                  # Maven 빌드 설정
│   ├── mvnw                     # Maven Wrapper
│   ├── mvnw.cmd                 # Maven Wrapper (Windows)
│   └── src/
│       ├── main/
│       │   ├── java/
│       │   │   └── com/example/miniscada/
│       │   │       └── MiniScadaApplication.java
│       │   └── resources/
│       │       ├── application.yml
│       │       ├── application-local.yml
│       │       └── db/migration/   # Flyway 마이그레이션 파일
│       └── test/
│
├── frontend/                    # Vite + React 프로젝트
│   ├── Dockerfile               # 프론트엔드용 도커 이미지 (개발용) 빌드 파일
│   ├── package.json             # Node.js 패키지 목록
│   ├── vite.config.ts           # Vite 설정 파일
│   └── src/                     # 실제 리액트 소스 코드
│
├── simulator/                   # Python Modbus Simulator
│   ├── Dockerfile               # 시뮬레이터용 도커 이미지 빌드 파일
│   ├── requirements.txt         # Python 패키지 목록
│   └── app/
│       └── simulator.py         # pymodbus 기반 가상 설비 서버
│
└── infra/                       # 인프라 설정 파일
    ├── mosquitto/
    │   └── mosquitto.conf       # MQTT Broker 설정
    └── timescaledb/
        └── init/
            └── 001_init_extensions.sql
```

---

## 2. 기본 폴더 및 파일 생성 커맨드 (터미널)

개발을 시작할 빈 폴더를 하나 만든 뒤, 터미널에서 아래 명령어들을 순서대로 실행해 주세요.

```bash
# 1. 루트 폴더 생성 및 이동
mkdir mini-scada
cd mini-scada

# 1-1. VS Code 워크스페이스 설정 폴더 생성 ⭐️
mkdir .vscode
touch .vscode/mini-scada.code-workspace

# 2. 백엔드 폴더 생성
mkdir -p backend/src/main/java/com/example/miniscada
mkdir -p backend/src/main/resources/db/migration
mkdir -p backend/src/test
touch backend/Dockerfile backend/pom.xml
touch backend/src/main/java/com/example/miniscada/MiniScadaApplication.java
touch backend/src/main/resources/application.yml
touch backend/src/main/resources/application-local.yml

# 3. 프론트엔드 폴더 생성 (Vite + React + TypeScript 환경 자동 구성)
npm create vite@latest frontend -- --template react-ts

# 4. 프론트엔드용 빈 Dockerfile 생성
touch frontend/Dockerfile

# 5. 시뮬레이터 폴더 생성
mkdir -p simulator/app
touch simulator/Dockerfile simulator/requirements.txt simulator/app/simulator.py

# 6. 인프라 설정 폴더 생성
mkdir -p infra/mosquitto
mkdir -p infra/timescaledb/init
touch infra/mosquitto/mosquitto.conf
touch infra/timescaledb/init/001_init_extensions.sql

# 7. 루트 설정 파일 생성
touch docker-compose.yml .env .gitignore
```

---

## 3. `docker-compose.yml` 작성

Mini SCADA 개발환경에서는 **TimescaleDB, Mosquitto, Backend, Frontend, Simulator** 총 5개 컨테이너가 함께 동작해야 합니다.
PRD의 전체 흐름이 **Modbus → Spring Boot → TSDB / MQTT → React Dashboard** 구조이기 때문입니다.

**Modbus TCP 포트:** 현장/문서에서 흔히 **502**를 쓰지만, 로컬 Docker에서는 호스트의 502 점유·권한 이슈를 피하기 위해 시뮬레이터를 **5020**에 띄우고, 백엔드 환경변수(`SIMULATOR_PORT` 등)로 그 포트를 바라보게 하는 구성입니다. 실제 장비 연동 시에는 설비 설정의 `port`를 장비에 맞게 두면 됩니다.

```yaml
version: '3.8'

services:
  timescaledb:
    image: timescale/timescaledb:2.14.2-pg15
    container_name: mini_scada_db
    restart: always
    env_file:
      - .env
    environment:
      POSTGRES_USER: ${DB_USER:-scada}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-scada_secret}
      POSTGRES_DB: ${DB_NAME:-mini_scada}
      TZ: UTC
    ports:
      - "5432:5432"
    volumes:
      - timescaledb_data:/var/lib/postgresql/data
      - ./infra/timescaledb/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  mosquitto:
    image: eclipse-mosquitto:2
    container_name: mini_scada_mqtt
    restart: always
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./infra/mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf
    healthcheck:
      test: ["CMD", "mosquitto_sub", "-t", "$SYS/broker/uptime", "-C", "1"]
      interval: 10s
      timeout: 5s
      retries: 5

  simulator:
    build:
      context: ./simulator
      dockerfile: Dockerfile
    container_name: mini_scada_simulator
    ports:
      - "5020:5020"
    volumes:
      - ./simulator:/app
    environment:
      MODBUS_PORT: 5020
      TZ: UTC
    command: python app/simulator.py

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: mini_scada_backend
    ports:
      - "8080:8080"
    volumes:
      - ./backend:/app
      - /root/.m2
    env_file:
      - .env
    environment:
      SPRING_PROFILES_ACTIVE: local
      DB_HOST: timescaledb
      DB_PORT: 5432
      DB_NAME: ${DB_NAME:-mini_scada}
      DB_USER: ${DB_USER:-scada}
      DB_PASSWORD: ${DB_PASSWORD:-scada_secret}
      MQTT_HOST: mosquitto
      MQTT_PORT: 1883
      MQTT_WS_PORT: 9001
      SIMULATOR_HOST: simulator
      SIMULATOR_PORT: 5020
      TZ: UTC
    depends_on:
      timescaledb:
        condition: service_healthy
      mosquitto:
        condition: service_healthy
      simulator:
        condition: service_started
    command: ./mvnw spring-boot:run

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: mini_scada_frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      VITE_API_URL: http://localhost:8080/api/v1
      VITE_MQTT_WS_URL: ws://localhost:9001
    depends_on:
      - backend
    command: npm run dev -- --host 0.0.0.0

volumes:
  timescaledb_data:
```

---

## 4. 환경 변수 (`.env`) 및 `.gitignore` 세팅

**`.env`**

```env
DB_USER=scada
DB_PASSWORD=scada_secret
DB_NAME=mini_scada

JWT_SECRET_KEY=change_this_secret_key
MQTT_USERNAME=
MQTT_PASSWORD=

SPRING_PROFILES_ACTIVE=local
```

**`.gitignore`**

```text
# Environments
.env
.idea/
.vscode/

# Maven / Java
target/
out/
*.class

# Node
node_modules/
dist/

# Python
__pycache__/
*.py[cod]
.venv/
venv/

# OS
.DS_Store
Thumbs.db
```

---

## 5. VS Code 멀티 루트 워크스페이스 설정 (`.vscode/mini-scada.code-workspace`) ⭐️

프론트엔드와 백엔드가 한 레포지토리에 있을 때, 언어 서버(Java, TS/ESLint) 충돌을 막고 효율적으로 개발하기 위한 워크스페이스 설정입니다.
VS Code에서 폴더 열기 대신, **이 파일을 `File > Open Workspace from File...`로 열어서 작업**하는 것을 권장합니다.

```json
{
  "folders": [
    {
      "path": "..",
      "name": "🚀 mini-scada"
    }
  ],
  "settings": {
    "java.configuration.updateBuildConfiguration": "automatic"
  }
}
```

---

## 6. `backend/pom.xml` 작성

Mini SCADA 백엔드는 PRD 기준으로 **Java 17+, Spring Boot, Spring Data JPA, TimescaleDB, MQTT** 를 사용합니다.
여기에 코드 생산성을 높이기 위한 **Lombok** 의존성도 추가되어 있습니다. ⭐️

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.2</version>
        <relativePath/>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>mini-scada</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>mini-scada</name>
    <description>Mini SCADA for Facility Monitoring</description>

    <properties>
        <java.version>17</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.integration</groupId>
            <artifactId>spring-integration-mqtt</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>

        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-core</artifactId>
        </dependency>

        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-database-postgresql</artifactId>
        </dependency>

        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>

        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>2.6.0</version>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>

        <dependency>
            <groupId>com.ghgande</groupId>
            <artifactId>j2mod</artifactId>
            <version>3.1.1</version>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

---

## 7. Maven Wrapper 생성

프로젝트 루트가 아니라 `backend/` 폴더 안에서 아래 명령으로 Maven Wrapper를 생성합니다.

```bash
cd backend
mvn -N wrapper:wrapper
```

생성 후 아래 파일이 생기면 정상입니다.

```text
backend/
├── mvnw
├── mvnw.cmd
└── .mvn/
    └── wrapper/
```

이후 로컬/도커 실행 시 `mvn` 대신 `./mvnw` 를 사용하면 됩니다.

---

## 8. `backend/Dockerfile` 작성

```dockerfile
FROM eclipse-temurin:17-jdk

WORKDIR /app

COPY .mvn .mvn
COPY mvnw mvnw.cmd pom.xml ./
RUN chmod +x ./mvnw

COPY src ./src

EXPOSE 8080

CMD ["./mvnw", "spring-boot:run"]
```

---

## 9. `frontend/Dockerfile` 작성

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

---

## 10. `simulator/requirements.txt`

```txt
pymodbus>=3.6.0
```

---

## 11. `simulator/Dockerfile` 작성

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5020

CMD ["python", "app/simulator.py"]
```

---

## 12. `infra/mosquitto/mosquitto.conf` 작성

```conf
listener 1883
protocol mqtt

listener 9001
protocol websockets

allow_anonymous true
```

---

## 13. `infra/timescaledb/init/001_init_extensions.sql` 작성

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

---

## 14. 실행 명령 예시

### 전체 개발환경 실행

```bash
docker compose up --build
```

### 백엔드 단독 실행

```bash
cd backend
./mvnw spring-boot:run
```

### 백엔드 빌드

```bash
cd backend
./mvnw clean package
```

### 테스트 실행

```bash
cd backend
./mvnw test
```

---

## 15. 구조 설명 요약

이 개발환경 구조는 다음 목적을 가진다.

1. **backend / frontend / simulator / infra 를 루트에서 함께 관리**
   * 빈자리 문서처럼 처음 시작하는 사람이 프로젝트 전체 구조를 한눈에 이해하기 쉽다. 

2. **Spring Boot 중심 백엔드 구조**
   * Mini SCADA의 핵심 로직이 Polling, 알람 판정, 시계열 저장, MQTT 전파에 있으므로 Java/Spring Boot 백엔드가 중심이 된다. 

3. **실시간 개발이 가능한 통합 로컬 환경**
   * 단순 CRUD 서비스가 아니라 Modbus Simulator, TimescaleDB, MQTT Broker가 함께 떠야 실제 SCADA 흐름을 검증할 수 있다. 

4. **Maven 기반 표준화**
   * `pom.xml`, `mvnw`, `spring-boot-maven-plugin` 을 사용해 Java/Spring 진입 장벽을 낮추고, 빌드/실행 명령을 일관되게 유지할 수 있다.

5. **최상의 개발자 경험 (DX) 지원**
   * VS Code의 멀티 루트 워크스페이스(`.code-workspace`)를 지원하여 프론트/백엔드 폴더별로 충돌 없는 쾌적한 에디터 환경을 제공한다.
   