FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

EXPOSE 5173

# compose에서 ./frontend 마운트 + /app/node_modules 볼륨 시, 예전 node_modules가 남아 패키지 누락이 나기 쉬움 → 기동 시 동기화
CMD ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0"]