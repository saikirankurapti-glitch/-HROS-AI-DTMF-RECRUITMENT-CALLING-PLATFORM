FROM debian:bookworm-slim
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends asterisk gettext-base ca-certificates && rm -rf /var/lib/apt/lists/*
COPY asterisk/ari.conf.tpl /templates/ari.conf.tpl
COPY asterisk/pjsip.conf.tpl /templates/pjsip.conf.tpl
COPY asterisk/http.conf /etc/asterisk/http.conf
COPY asterisk/rtp.conf /etc/asterisk/rtp.conf
COPY asterisk/extensions.conf /etc/asterisk/extensions.conf
COPY asterisk/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 5060/udp 10000-10020/udp 8088/tcp
ENTRYPOINT ["/entrypoint.sh"]
