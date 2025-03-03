FROM node:23-bookworm
WORKDIR /app
EXPOSE 3000
RUN apt-get update && apt-get install -y python3
RUN apt-get update && apt-get install -y cron
RUN echo '15 * * * * root /app/parser/run_parser.sh >> /app/parser/parser.log 2>&1' > /etc/cron.d/bayareashows.com
RUN chmod -R 0644 /etc/cron.d/bayareashows.com
RUN crontab /etc/cron.d/bayareashows.com
