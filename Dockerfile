FROM node:23-bookworm
EXPOSE 3000
RUN apt update && apt install -y python3
RUN apt update && apt install -y cron
RUN apt update && apt install -y python3-venv
RUN echo '15 * * * * node /app/parser/run_parser.sh >> /app/parser/parser.log 2>&1' > /etc/cron.d/bayareashows.com
RUN chmod -R 0644 /etc/cron.d/bayareashows.com
RUN crontab /etc/cron.d/bayareashows.com
WORKDIR /app
