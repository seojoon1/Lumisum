FROM node:20-alpine AS development-dependencies-env
# better-sqlite3 는 네이티브 모듈이라 alpine(musl)에서는 소스 빌드가 필요하다
RUN apk add --no-cache python3 make g++
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:20-alpine AS production-dependencies-env
RUN apk add --no-cache python3 make g++
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:20-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache libstdc++
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
# 전적 DB 저장 위치. 컨테이너를 지워도 기록이 남도록 볼륨으로 마운트할 것.
ENV LUMISUM_DB=/app/data/lumisum.db
VOLUME ["/app/data"]
CMD ["npm", "run", "start"]
