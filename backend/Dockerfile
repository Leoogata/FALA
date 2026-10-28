# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: dependências de produção
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: gera Prisma Client
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: imagem de produção
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS production

WORKDIR /app

# Dependências de sistema para OCR:
#   poppler-utils  → pdftoppm (converte páginas PDF em imagens PNG)
#   tesseract-ocr  → motor OCR base
#   tesseract-ocr-por → modelo português
#   tesseract-ocr-eng → modelo inglês
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-por \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# Copia dependências de produção e Prisma Client gerado
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Copia código-fonte
COPY src ./src
COPY prisma ./prisma
COPY package.json ./

# Diretório para uploads (montado como volume em produção)
RUN mkdir -p uploads

# Usuário não-root para segurança
RUN groupadd -r ponte && useradd -r -g ponte ponte
RUN chown -R ponte:ponte /app
USER ponte

EXPOSE 3000

CMD ["node", "src/server.js"]
