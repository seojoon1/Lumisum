FROM node:20-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:20-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:20-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:20-alpine
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
# 전적 DB는 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 으로 원격(Turso)에 붙는다.
# 두 값을 주지 않으면 로컬 파일 /app/data/lumisum.db 로 떨어지므로, 그때는 볼륨을 붙일 것.
VOLUME ["/app/data"]
CMD ["npm", "run", "start"]
