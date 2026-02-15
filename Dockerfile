FROM node:23-bookworm
EXPOSE 3000
RUN apt update && apt install -y python3 python3-venv supervisor git logrotate
RUN curl -sL https://github.com/aptible/supercronic/releases/latest/download/supercronic-linux-amd64 \
  -o /usr/local/bin/supercronic && \
  chmod +x /usr/local/bin/supercronic
RUN git clone https://github.com/jpcastberg/bayareashows.com.git /app
WORKDIR /app
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY logrotate.conf /etc/logrotate.d/app
RUN chown -R node:node /app /var/log
USER node
ENTRYPOINT []
CMD ["supervisord", "-n"]
