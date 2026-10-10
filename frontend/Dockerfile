# ─────────────────────────────────────────────────────────────
# WAYDEE — kullanıcı arayüzü (Vite/React → nginx)
#
# Neden nginx + proxy: uygulama API'yi **göreli** yollarla çağırır
# (`/api/v1`, `/ws`). Aynı origin'de kalmak iki şeyi bedavaya getirir:
#   · CORS ayarı gerekmez,
#   · WebSocket `window.location.host` ile çalışır (kod değişmez).
# Backend adresi çalışma zamanında `BACKEND_URL` ile verilir.
# ─────────────────────────────────────────────────────────────

# ---- derleme ----
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable
# CI=true: pnpm etkileşimli onay beklemez (konteynerde TTY yok).
ENV CI=true

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .

# Vite değişkenleri DERLEME zamanında gömülür.
# Mapbox anahtarı ARTIK ZORUNLU DEĞİL: asıl anahtar sunucudan (`GET /api/v1/config`)
# gelir ve yönetim panelinden değiştirilir. Buradaki değer yalnızca yedektir.
ARG VITE_TURNSTILE_SITE_KEY=""
ARG VITE_MAPBOX_TOKEN=""
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY \
    VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN

RUN pnpm build

# ---- çalışma ----
FROM nginx:1.27-alpine

# nginx imajı /etc/nginx/templates/*.template dosyalarındaki ${DEĞİŞKEN}leri
# açılışta envsubst ile doldurur → BACKEND_URL çalışma zamanında verilebilir.
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV BACKEND_URL=http://backend:8091

EXPOSE 80
