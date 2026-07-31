# ---- 개발 스테이지 (Hot Reload) ----
FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ---- 빌드 스테이지 ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
ARG VITE_API_BASE_URL=/api
ARG VITE_COGNITO_REGION=ap-northeast-2
ARG VITE_COGNITO_USER_POOL_ID
ARG VITE_COGNITO_CLIENT_ID
ARG VITE_COGNITO_DOMAIN
ARG VITE_COGNITO_REDIRECT_URI
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_COGNITO_REGION=${VITE_COGNITO_REGION}
ENV VITE_COGNITO_USER_POOL_ID=${VITE_COGNITO_USER_POOL_ID}
ENV VITE_COGNITO_CLIENT_ID=${VITE_COGNITO_CLIENT_ID}
ENV VITE_COGNITO_DOMAIN=${VITE_COGNITO_DOMAIN}
ENV VITE_COGNITO_REDIRECT_URI=${VITE_COGNITO_REDIRECT_URI}
RUN npm run build

# ---- 프로덕션 스테이지 (정적 파일 서빙) ----
FROM nginx:alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
# SPA fallback + .mjs MIME 교정 (frontend/nginx.conf 참고)
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
