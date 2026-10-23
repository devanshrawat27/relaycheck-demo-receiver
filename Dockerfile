FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3100
ENV RELAYCHECK_TEST_MODE=true
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY --from=build /app/dist ./dist
EXPOSE 3100
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

