FROM oven/bun:1.4.2 AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run gen:all
USER bun
EXPOSE 8080
CMD ["bun", "--smol", "src/index.ts"]
