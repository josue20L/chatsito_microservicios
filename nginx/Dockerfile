FROM nginx:alpine
COPY nginx.docker.conf /etc/nginx/nginx.conf
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1
