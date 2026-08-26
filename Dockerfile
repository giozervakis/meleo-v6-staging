# MELEO — production image
FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# 1) Εξαρτήσεις (ξεχωριστό layer για caching)
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# 2) Κώδικας & build του frontend
COPY . .
RUN npm run build && npm prune --omit=dev

# 3) Μη-root χρήστης
RUN useradd -r -u 10001 meleo && mkdir -p /app/secure_uploads && chown -R meleo:meleo /app
USER meleo

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]