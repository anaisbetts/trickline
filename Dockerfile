FROM abiosoft/caddy
MAINTAINER Paul Betts <paul@paulbetts.org>

COPY dist /srv
COPY Caddyfile /etc/Caddyfile

EXPOSE 443

ENTRYPOINT ["/usr/bin/caddy"]
CMD ["--conf", "/etc/Caddyfile"]
