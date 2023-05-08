FROM node:15.8.0 as builder

ENV PORT=5000
ENV NODE_ENV=production

WORKDIR /app

COPY . .

RUN npm set-script prepare ""
RUN npm ci --omit=dev
RUN npm run build

CMD DEBUG=socket* node dist/index.js
