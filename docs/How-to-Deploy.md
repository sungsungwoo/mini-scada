
이 레포는 **로컬 개발용 `docker-compose.yml`**(프론트는 Vite dev, 백엔드는 `mvnw spring-boot:run` + 소스 마운트)에 맞춰져 있어, AWS 상용에서는 **이미지 빌드·환경변수·재시작 정책**을 별도로 잡는다고 보면 됩니다.

---

## 1. Git 절차

### 1) 저장소 준비

- 원격: **GitHub / GitLab / AWS CodeCommit** 등 하나를 선택합니다.
- 이 워크스페이스가 아직 Git 저장소가 아니면, 프로젝트 루트에서:
  - `git init`
  - `.gitignore`에 최소한 다음을 포함합니다.  
    **`.env`**, `frontend/node_modules/`, `backend/target/`, OS/IDE 파일 등 — **비밀번호·JWT 시크릿이 들어간 `.env`는 절대 커밋하지 않습니다.**

### 2) 브랜치

- **`main`**: 배포에 쓰는 안정 브랜치.
- **`develop`**(선택): 통합 개발용.
- 기능 작업은 `feature/...` 브랜치에서 하고, PR로 `main`에 머지하는 방식이 일반적입니다.

### 3) 푸시·배포 연동

- **EC2에서 직접 배포**: 서버에 `git clone` / `git pull` 후 빌드·재기동(스크립트 또는 수동).
- **CI/CD 권장**: GitHub Actions 등에서 `main` 푸시 시 Docker 이미지 빌드 → ECR 푸시 → ECS/EC2에서 배포.
- **시크릿**: Git에는 **`.env.example`만** 두고, 실제 값은 AWS **Secrets Manager / SSM Parameter Store** 또는 배포 파이프라인의 시크릿 변수에만 둡니다.

### 4) 레포에 두면 좋은 것

- **`.env.example`**: 키 이름만(값은 비우거나 예시). 이미 프로젝트에 있습니다.
- 배포용 **`docker-compose.prod.yml`** 또는 **프로덕션용 Dockerfile 스테이지**는 코드로 관리하되, **실제 비밀 값은 저장소 밖**에서 주입합니다.


it init
git branch -M main
git remote add origin https://github.com/sungsungwoo/mini-scada.git
git add .
git commit -m "init mini scada"
git push -u origin main


---

## 2. 상용 설정 방법 (`.env` / Dockerfile)

### 원칙

- **개발용 `docker-compose.yml`**은 그대로 두고, 상용은 **별도 compose 파일** 또는 **ECS 태스크 정의**로 분리하는 편이 안전합니다.
- 현재 구성상 주의점:
  - **백엔드**: compose에서 `SPRING_PROFILES_ACTIVE: local`, `command: ./mvnw spring-boot:run`, 소스 **볼륨 마운트** → **상용에 부적합**.
  - **프론트**: `npm run dev` + Vite → **상용은 `npm run build` 후 Nginx 등으로 정적 파일 서빙**이 일반적입니다.

### `.env` (상용)

로컬 `.env.example`에 맞춰, **배포 환경에서만** 다음을 강하게 권장합니다.

| 항목 | 설명 |
|------|------|
| `DB_*` | RDS(Timescale/PostgreSQL) 접속 정보. 가능하면 **Secrets Manager 참조**. |
| `JWT_SECRET_KEY` | **32바이트 이상 무작위 문자열**. 개발용 값 그대로 쓰지 않기. |
| `SPRING_PROFILES_ACTIVE` | 상용에서는 `prod` 같은 프로필을 두고 CORS·로깅 등을 제한하는 방식이 일반적입니다(현재는 `application-local.yml`만 추가로 있음). |
| `MQTT_*` | 브로커가 인증을 켠 경우 `MQTT_USERNAME` / `MQTT_PASSWORD` 등 `application.yml`과 맞춤. |

**프론트(Vite)**는 빌드 시점에 `VITE_*`가 박히므로, 상용에서는:

- **`VITE_API_ORIGIN`**: 브라우저가 호출할 **공개 API URL** (예: `https://api.example.com`).
- **`VITE_MQTT_WS_URL`**: 브라우저에서 접속할 **WSS URL** (예: `wss://mqtt.example.com:9001`).  
  ALB/리버스 프록시 뒤에 둘 경우 그 주소에 맞춥니다.

Docker로 프론트를 빌드할 때 `ARG`/`ENV`로 위 값을 넣고 `npm run build` 한 뒤, Nginx로 `dist`를 서빙하는 패턴이 흔합니다.

### Dockerfile (상용 방향)

현재 파일은 **개발 편의**에 가깝습니다.

- **`backend/Dockerfile`**: 상용은 보통 **멀티 스테이지**로 `mvnw package -DskipTests` 후 **`java -jar`만** 실행하는 **슬림 JRE 이미지**로 두는 것이 좋습니다. 소스 마운트 없이 **이미지 안에 JAR만** 포함합니다.
- **`frontend/Dockerfile`**: `npm ci` → `npm run build` → **Nginx(또는 Caddy)** 로 `/usr/share/nginx/html` 서빙. dev 서버(`npm run dev`)는 상용에서 제거합니다.

### 데이터베이스·MQTT

- **EC2 + Compose**로 간다면: 같은 호스트에 DB/MQTT를 두거나, **RDS + 관리형 MQTT(또는 별도 EC2의 Mosquitto)** 로 나눕니다.
- **ECS/Fargate**면: DB는 **RDS**, MQTT는 **별도 서비스 또는 AWS IoT Core** 등 아키텍처에 맞게 선택합니다.

### 네트워크·보안

- **ALB + HTTPS** termination, 백엔드는 private 서브넷.
- Spring **CORS**에 프론트 도메인 허용(코드에 설정이 있다면 상용 URL로).
- **5020 Modbus 시뮬레이터**는 상용에서 보통 **끄거나** 데모 전용으로만 둡니다.

---

## 3. 상용에서 프로세스 다운 시 자동 기동

목표는 **“죽으면 다시 뜬다”** + 가능하면 **“장애 호스트도 교체”** 입니다.

### A) Docker Compose on EC2 (가장 단순)

- `docker-compose.yml`에 이미 **`restart: always`** 가 **timescaledb**, **mosquitto**에 있습니다. 상용 compose에서는 **backend / frontend**에도 동일하게 줄 수 있습니다.
- **호스트 재부팅 후**에도 자동 기동하려면:
  - `docker compose up -d`를 **`systemd` 유닛**으로 등록하거나,
  - `restart: always` + Docker 데몬이 부팅 시 시작되도록 설정합니다.

한계: **한 대 EC2**면 그 머신 장애 시 수동 복구에 가깝습니다.

### B) systemd (EC2에 JAR/바이너리 직접 실행 시)

- `Restart=always` + `RestartSec=5` 같은 설정으로 **프로세스 크래시 시 재시작**.
- `WantedBy=multi-user.target`으로 **부팅 시 자동 시작**.

### C) AWS ECS (Fargate 또는 EC2 시작 타입)

- **서비스(Service)**에 **desired count ≥ 1**, 태스크가 비정상 종료되면 **새 태스크 자동 배치**.
- **로드 밸런서 헬스 체크** 실패 시 태스크 교체.
- 이 방식이 **컨테이너 수준 자동 복구**에는 가장 많이 쓰입니다.

### D) Amazon EKS (Kubernetes)

- **Deployment** `replicas` + **livenessProbe** / **readinessProbe** 로 Pod 재시작.
- 노드는 **Node Group + ASG**로 보강.

### E) Elastic Beanstalk / App Runner

- 플랫폼이 **헬스 체크 실패 시 인스턴스/버전 교체**를 일부 대신해 줍니다. 구조는 단순하지만 커스터마이징은 ECS보다 제한적일 수 있습니다.

### 운영 팁

- **헬스 체크**: Spring은 `management.endpoint.health`가 이미 열려 있으므로(`application.yml`), ALB/컨테이너 프로브는 `/actuator/health` 등으로 맞추면 됩니다.
- **MQTT·DB**도 애플리케이션과 같이 **`restart` 정책** 또는 **관리형 서비스**로 가용성을 맞춥니다.

---

## 요약

1. **Git**: `.env` 제외, `main` 기준 배포, 시크릿은 저장소가 아니라 AWS/CI 시크릿에 둡니다.  
2. **상용 설정**: 개발용 compose 그대로 쓰지 말고, **JAR + 정적 빌드 + 강한 시크릿 + 올바른 `VITE_*`/DB URL**; 필요 시 **`application-prod.yml`** 추가.  
3. **자동 기동**: Compose면 **`restart: always` + (선택) systemd**; 본격적이면 **ECS 서비스 + 헬스 체크** 또는 **K8s Deployment**.

원하시면 다음 단계로 **“EC2 단일 + Docker Compose 상용 예시”**와 **“ECS + RDS + ALB”** 중 하나를 골라서, 이 레포 기준으로 **구체적인 파일 초안**(예: `docker-compose.prod.yml`, 백엔드 멀티스테이지 Dockerfile)까지 맞춰 드리겠습니다.























GitHub 기준으로는 이 흐름이 가장 깔끔합니다.

**GitHub(main push)** → **GitHub Actions** → **Amazon ECR**(이미지 저장) → **EC2**에서 **SSM Run Command**로 `docker compose pull && up -d` 자동 실행

이 방식이면 GitHub Actions가 OIDC로 AWS에 접속하므로 장기 AWS 키를 GitHub Secrets에 넣지 않아도 되고, 워크플로에는 `id-token: write` 권한이 필요합니다. EC2는 SSM 관리형 노드로 두면 안전하게 원격 명령 실행이 가능하고, 인스턴스 역할에는 최소 `AmazonSSMManagedInstanceCore`와 ECR pull 권한(예: `AmazonEC2ContainerRegistryPullOnly`)을 주면 됩니다. ([GitHub Docs][1])

먼저, 지금 올린 `docker-compose.yml`은 **개발용**입니다. AWS 운영 배포 전에는 아래처럼 바꾸는 게 좋습니다.

* `backend`: `./mvnw spring-boot:run` 대신 **빌드된 이미지 실행**
* `frontend`: Vite dev server(`5173`) 대신 **정적 빌드 후 nginx/caddy로 서빙**
* `volumes: ./backend:/app`, `./frontend:/app` 같은 **바인드 마운트 제거**
* `docker-compose.prod.yml` 별도 분리
* `5432`, `1883`, `5173` 같은 포트는 외부 공개 최소화
  보안 그룹은 EC2의 인바운드/아웃바운드 트래픽을 제어하는 가상 방화벽입니다. 운영이면 보통 공개 포트는 `80/443` 위주로 두고, DB는 내부에서만 접근하게 둡니다. ([AWS 문서][2])

## 1) Git 저장소 준비

GitHub에 repo를 만들고 처음 올립니다.

```bash
git init
git branch -M main
git remote add origin git@github.com:<GITHUB_ORG>/<REPO>.git
git add .
git commit -m "init mini scada"
git push -u origin main
```

브랜치는 보통 이렇게 두면 편합니다.

* `main`: 운영 자동배포
* `develop`: 개발 서버 자동배포

## 2) AWS 1회성 설정

### 2-1. ECR 리포지토리 생성

백엔드/프론트/시뮬레이터용 이미지 저장소를 만듭니다. ECR은 private repository를 만들어 Docker/OCI 이미지를 저장할 수 있습니다. ([AWS 문서][3])

```bash
aws ecr create-repository --repository-name mini-scada/backend --region ap-northeast-2
aws ecr create-repository --repository-name mini-scada/frontend --region ap-northeast-2
aws ecr create-repository --repository-name mini-scada/simulator --region ap-northeast-2
```

### 2-2. EC2 생성

Amazon Linux 2023 기준으로 1대 만듭니다. Docker는 Amazon Linux 2023에서 `yum install -y docker`로 설치할 수 있고, Docker Compose는 Linux용 Compose plugin 방식이 권장됩니다. ([AWS 문서][4])

보안 그룹은 최소로 여세요.

* `80`, `443`: 전체 허용
* `22`: 꼭 필요할 때만 내 IP 허용
* `5432`, `1883`, `9001`: 정말 필요한 경우만 제한적으로 허용

### 2-3. EC2 IAM Role 부여

EC2 인스턴스 역할에 최소 이 2개를 붙이세요.

* `AmazonSSMManagedInstanceCore`
* `AmazonEC2ContainerRegistryPullOnly` 또는 `AmazonEC2ContainerRegistryReadOnly`

AWS는 각각 SSM core functionality, ECR pull/read 권한용 관리형 정책으로 설명합니다. ([AWS 문서][5])

--> How-to-Deploy-MakeRole.docx 참조
### 2-4. GitHub OIDC 연동용 IAM Role 생성

GitHub OIDC Provider는 `https://token.actions.githubusercontent.com`, audience는 `sts.amazonaws.com`으로 설정합니다. 
GitHub와 AWS 문서는 trust policy에서 `sub` 조건으로 어떤 repo/branch만 role을 assume할지 제한하라고 안내합니다. ([GitHub][6])

예시 trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrAuth",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "EcrPushBackendFrontend",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": [
        "arn:aws:ecr:ap-northeast-2:237586138150:repository/mini-scada/backend",
        "arn:aws:ecr:ap-northeast-2:237586138150:repository/mini-scada/frontend"
      ]
    },
    {
      "Sid": "AllowSendCommandToMiniScadaEC2",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ec2:ap-northeast-2:237586138150:instance/i-04beb410cd209d9f0",
        "arn:aws:ssm:ap-northeast-2::document/AWS-RunShellScript"
      ]
    },
    {
      "Sid": "AllowReadCommandStatus",
      "Effect": "Allow",
      "Action": [
        "ssm:GetCommandInvocation",
        "ssm:ListCommandInvocations",
        "ec2:DescribeInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

AmazonEC2ContainerRegistryPowerUser를 붙였다면 ECR는 관리형 정책에 맡기고, inline policy는 SSM/EC2만 둡니다.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSendCommandToMiniScadaEC2",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ec2:ap-northeast-2:237586138150:instance/i-04beb410cd209d9f0",
        "arn:aws:ssm:ap-northeast-2::document/AWS-RunShellScript"
      ]
    },
    {
      "Sid": "AllowReadCommandStatus",
      "Effect": "Allow",
      "Action": [
        "ssm:GetCommandInvocation",
        "ssm:ListCommandInvocations",
        "ssm:ListCommands",
        "ec2:DescribeInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

이 Role에는 최소로 아래 권한이 필요합니다.

* ECR push 권한
* SSM `SendCommand` 권한
* 필요 시 `ec2:DescribeInstances`

ECR push는 리포지토리별 least privilege로 줄 수 있습니다. AWS도 push용 IAM 권한을 별도로 안내합니다. ([AWS 문서][7])

--> How-to-Deploy-MakeRole.docx 참조

### 2-5. GitHub OIDC 연동용 IAM Role 이름

role이 github-actions-mini-scada-deploy-role이면 policy name은 GitHubActionsMiniScadaDeployPolicy처럼 두면 알아보기 쉽습니다.

### 2-6. EC2가 SSM 관리 대상으로 잡혔는지 확인

먼저 AWS 콘솔에서 Systems Manager → Fleet Manager / Managed nodes로 들어가서, 네 EC2 인스턴스가 목록에 보이는지 확인하세요. 
Run Command는 managed node에만 실행할 수 있고, managed node가 되려면 기본적으로 SSM Agent가 설치·실행 중이어야 하고 Systems Manager 서비스와 통신 가능해야 합니다.


## 3) EC2에 배포 디렉터리 준비

EC2에 접속해서 한 번만 준비합니다.

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME:-$VERSION_ID}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu

sudo mkdir -p /opt/mini-scada
sudo chown -R ubuntu:ubuntu /opt/mini-scada
cd /opt/mini-scada
```

`usermod` 후에는 **로그아웃했다가 다시 SSH** 하거나, 당장만 `newgrp docker` 로 그룹을 적용합니다.

여기에 아래 파일들을 둡니다.

* `docker-compose.prod.yml`
* `.env.prod`
* `deploy.sh`

docker --version
docker compose version
docker ps

## 4) prod용 compose 예시

지금 compose를 그대로 운영에 쓰지 말고, `build:` 대신 `image:`를 쓰는 prod 파일을 따로 두세요.

```yaml
services:
  timescaledb:
    image: timescale/timescaledb:2.14.2-pg15
    container_name: mini_scada_db
    restart: always
    env_file:
      - .env.prod
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
      TZ: UTC
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
    volumes:
      - ./infra/mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf

  simulator:
    image: ${ECR_REGISTRY}/mini-scada/simulator:${IMAGE_TAG}
    container_name: mini_scada_simulator
    restart: always
    environment:
      MODBUS_PORT: 5020
      TZ: UTC

  backend:
    image: ${ECR_REGISTRY}/mini-scada/backend:${IMAGE_TAG}
    container_name: mini_scada_backend
    restart: always
    env_file:
      - .env.prod
    environment:
      SPRING_PROFILES_ACTIVE: prod
      DB_HOST: timescaledb
      DB_PORT: 5432
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      MQTT_HOST: mosquitto
      MQTT_PORT: 1883
      MQTT_WS_PORT: 9001
      SIMULATOR_HOST: simulator
      SIMULATOR_PORT: 5020
      TZ: UTC
    depends_on:
      timescaledb:
        condition: service_healthy
      simulator:
        condition: service_started

  frontend:
    image: ${ECR_REGISTRY}/mini-scada/frontend:${IMAGE_TAG}
    container_name: mini_scada_frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  timescaledb_data:
```

중요한 점은 `frontend`가 prod에서는 Vite dev server가 아니라 nginx/caddy 같은 웹서버로 정적 파일을 서비스해야 한다는 점입니다. 또 브라우저에서 MQTT WebSocket을 직접 쓸 거면 `9001`을 열거나, 더 깔끔하게는 `443` 뒤 reverse proxy로 붙이는 편이 좋습니다.

## 5) EC2 배포 스크립트

`/opt/mini-scada/deploy.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-northeast-2}"
IMAGE_TAG="${1:?IMAGE_TAG is required}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

cd /opt/mini-scada

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

export ECR_REGISTRY
export IMAGE_TAG

docker compose -f docker-compose.prod.yml pull backend frontend simulator
docker compose -f docker-compose.prod.yml up -d --remove-orphans

docker image prune -af
```

ECR 인증은 AWS 문서대로 `aws ecr get-login-password | docker login --username AWS --password-stdin <registry>` 방식으로 하면 됩니다. 같은 Region을 써야 합니다. ([AWS 문서][8])

실행권한도 주세요.

```bash
chmod +x /opt/mini-scada/deploy.sh
```

## 6) GitHub Actions 자동배포

`.github/workflows/deploy-prod.yml`

```yaml
name: deploy-prod

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: ap-northeast-2
  ECR_BACKEND: mini-scada/backend
  ECR_FRONTEND: mini-scada/frontend
  ECR_SIMULATOR: mini-scada/simulator
  EC2_INSTANCE_ID: i-xxxxxxxxxxxxxxxxx

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v6
        with:
          aws-region: ${{ env.AWS_REGION }}
          role-to-assume: arn:aws:iam::<ACCOUNT_ID>:role/github-actions-mini-scada-deploy

      - name: Resolve ECR registry
        id: meta
        run: |
          ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
          echo "registry=${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com" >> "$GITHUB_OUTPUT"

      - name: Login to ECR
        run: |
          aws ecr get-login-password --region "$AWS_REGION" \
            | docker login --username AWS --password-stdin "${{ steps.meta.outputs.registry }}"

      - name: Build and push backend
        run: |
          docker build -t "${{ steps.meta.outputs.registry }}/${ECR_BACKEND}:${GITHUB_SHA}" ./backend
          docker push "${{ steps.meta.outputs.registry }}/${ECR_BACKEND}:${GITHUB_SHA}"

      - name: Build and push frontend
        run: |
          docker build -t "${{ steps.meta.outputs.registry }}/${ECR_FRONTEND}:${GITHUB_SHA}" ./frontend
          docker push "${{ steps.meta.outputs.registry }}/${ECR_FRONTEND}:${GITHUB_SHA}"

      - name: Build and push simulator
        run: |
          docker build -t "${{ steps.meta.outputs.registry }}/${ECR_SIMULATOR}:${GITHUB_SHA}" ./simulator
          docker push "${{ steps.meta.outputs.registry }}/${ECR_SIMULATOR}:${GITHUB_SHA}"

      - name: Trigger deploy on EC2 via SSM
        run: |
          aws ssm send-command \
            --instance-ids "${EC2_INSTANCE_ID}" \
            --document-name "AWS-RunShellScript" \
            --comment "mini-scada deploy ${GITHUB_SHA}" \
            --parameters 'commands=["/opt/mini-scada/deploy.sh '${GITHUB_SHA}'"]' \
            --cloud-watch-output-config CloudWatchOutputEnabled=true
```

GitHub OIDC를 쓰는 워크플로는 `id-token: write`가 필요하고, `aws-actions/configure-aws-credentials`는 OIDC 기반 role assume 구성을 공식적으로 지원합니다. SSM `send-command`는 Run Command를 호출하며, 출력은 CloudWatch Logs로 보낼 수 있습니다. ([GitHub][9])

## 7) 실제 동작 순서

이제부터는 이렇게 굴러갑니다.

1. 로컬에서 코드 수정
2. `git push origin main`
3. GitHub Actions가 이미지 3개 빌드
4. ECR에 push
5. SSM이 EC2에 `/opt/mini-scada/deploy.sh <git-sha>` 실행
6. EC2가 새 이미지를 pull하고 `docker compose up -d`
7. 완료

## 8) 지금 네 compose 기준에서 꼭 체크할 것

* `frontend`는 지금 `VITE_API_ORIGIN=http://localhost:8080`인데, 운영에서는 `localhost`가 아니라 **실제 도메인** 또는 reverse proxy 기준 경로로 바꿔야 합니다.
* `VITE_MQTT_WS_URL=ws://localhost:9001`도 운영에선 **도메인 기준**으로 바꿔야 합니다.
* `backend`의 `- /root/.m2`는 현재 캐시 의도가 애매합니다. prod에서는 보통 제거하고, Docker build 단계에서 dependency cache를 쓰는 쪽이 낫습니다.
* `timescaledb`, `mosquitto` 데이터는 EC2 단일 인스턴스면 EBS에 저장됩니다. 운영 안정성을 더 보려면 나중에 RDS/Managed MQTT로 분리하는 단계도 생각할 수 있습니다.

가장 현실적인 시작점은 **단일 EC2 + docker compose 자동배포**입니다.
다음 단계로 바로 이어서, 네 프로젝트 구조에 맞춘 **`docker-compose.prod.yml` 완성본**과 **frontend/backend Dockerfile 운영용 버전**까지 붙여서 정리해줄게.

[1]: https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services?utm_source=chatgpt.com "Configuring OpenID Connect in Amazon Web Services"
[2]: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html?utm_source=chatgpt.com "Amazon EC2 security groups for your EC2 instances"
[3]: https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-create.html?utm_source=chatgpt.com "Creating an Amazon ECR private repository to store images"
[4]: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-docker.html?utm_source=chatgpt.com "Installing Docker to use with the AWS SAM CLI"
[5]: https://docs.aws.amazon.com/aws-managed-policy/latest/reference/AmazonSSMManagedInstanceCore.html?utm_source=chatgpt.com "AmazonSSMManagedInstanceC..."
[6]: https://github.com/aws-actions/configure-aws-credentials?utm_source=chatgpt.com "Configure AWS credential environment variables for use ..."
[7]: https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-push-iam.html?utm_source=chatgpt.com "IAM permissions for pushing an image to an Amazon ECR ..."
[8]: https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html?utm_source=chatgpt.com "Private registry authentication in Amazon ECR"
[9]: https://github.com/marketplace/actions/configure-aws-credentials-action-for-github-actions?utm_source=chatgpt.com "\"Configure AWS Credentials\" Action for GitHub Actions"







AWS **EC2(Elastic Compute Cloud)**는 한마디로 **"AWS 클라우드에서 빌려 쓰는 가상의 컴퓨터(서버)"**입니다.

물리적인 컴퓨터(서버 장비)를 직접 구매하고 조립해서 인터넷 선을 꽂는 대신, AWS 웹사이트에서 클릭 몇 번만으로 원하는 사양의 컴퓨터를 인터넷상에 만들어내고 원격으로 접속해 사용할 수 있게 해주는 핵심 서비스입니다.

기존에 물리 서버를 운영할 때와 비교해 EC2가 가진 핵심적인 특징은 다음과 같습니다.

### ✨ EC2의 3가지 핵심 특징

1. **초고속 생성 및 삭제 (Elastic, 탄력성):**
   * 필요할 때 1분 만에 새로운 서버를 만들어낼 수 있고, 더 이상 필요 없어지면 즉시 삭제할 수 있습니다. 
   * 트래픽이 몰릴 때는 서버를 10대로 늘렸다가, 한가해지면 다시 1대로 줄이는 유연한 대처가 가능합니다. (이름에 'Elastic'이 들어가는 이유입니다.)

2. **사용한 만큼만 지불 (Pay-as-you-go):**
   * 비싼 서버 장비를 미리 살 필요 없이, 내가 가상 컴퓨터를 켜놓은 시간(초 또는 시간 단위)만큼만 요금을 냅니다. 서버를 꺼두면(Stop) 컴퓨터 대여 비용은 발생하지 않습니다.

3. **완벽한 제어권 (Root 권한):**
   * 생성된 가상 컴퓨터는 완전히 독립된 하나의 컴퓨터입니다. 
   * Linux(Ubuntu, Amazon Linux 등)나 Windows 등 원하는 운영체제(OS)를 선택할 수 있으며, 최고 관리자(Root) 권한을 가지기 때문에 원하는 프로그램은 무엇이든 설치할 수 있습니다.

---

### 💡 어떻게 활용될까요? (실무 관점)

일반적인 웹 서비스 개발을 예로 들면 EC2는 다음과 같이 사용됩니다.

클릭 몇 번으로 적당한 사양의 리눅스(Linux) EC2 인스턴스를 하나 대여합니다. 이 가상 컴퓨터에 원격으로 접속하여 **Docker와 Docker Compose를 설치**합니다. 그리고 개발해 둔 **FastAPI 기반의 백엔드 API 서버와 Next.js로 만든 프론트엔드 컨테이너**를 띄우면, 전 세계 어디서나 접속할 수 있는 실제 라이브 웹 서비스가 배포되는 것입니다.

### 🔗 앞선 질문들과의 연결고리 총정리

지금까지 질문하신 내용들이 사실 하나의 거대한 **"안전하고 모던한 서버 배포 아키텍처"**로 연결됩니다.

1. **EC2:** 내가 띄운 도커 컨테이너와 애플리케이션 코드가 실제로 실행되는 **가상의 컴퓨터(서버)**입니다.
2. **EC2 IAM Role:** 이 가상 컴퓨터(EC2) 안에서 돌아가는 애플리케이션이 다른 AWS 서비스(예: 이미지 저장을 위한 S3)에 접근할 때 필요한 **출입증**입니다.
3. **SSM:** 이 가상 컴퓨터(EC2)에 SSH 키보안 위험 없이 안전하게 원격 접속하고, 환경변수(DB 비밀번호 등)를 안전하게 주입해 주는 **통제실**입니다.
4. **GitHub OIDC:** 내 로컬 컴퓨터에서 코드를 짜고 GitHub에 푸시했을 때, GitHub Actions가 이 가상 컴퓨터(EC2)나 AWS 환경에 새 버전을 배포할 수 있도록 열어주는 **임시 보안 통로**입니다.