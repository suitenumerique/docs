# trixie for glibc >= 2.38 — uws prebuilt binaries reject bookworm's 2.36
FROM node:22-trixie AS yhub

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./

EXPOSE 3002

CMD ["node", "server.js"]
