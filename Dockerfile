FROM node:23-bookworm
EXPOSE 3000
RUN apt update && apt install -y python3 cron python3-venv supervisor git
RUN git clone https://github.com/jpcastberg/bayareashows.com.git /app
WORKDIR /app
# for the below command - node is the user, not the executable
RUN echo "45 * * * * node /app/parser/run_parser.sh >> /app/parser/parser.log 2>&1" > /etc/cron.d/bayareashows.com \
 && echo "" >> /etc/cron.d/bayareashows.com
RUN chmod 0644 /etc/cron.d/bayareashows.com
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
ENTRYPOINT []
CMD ["supervisord", "-n"]
