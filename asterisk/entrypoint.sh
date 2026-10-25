#!/bin/sh
set -eu
test -n "$ASTERISK_ARI_USER"
test -n "$ASTERISK_ARI_PASSWORD"
test -n "$SIP_1001_PASSWORD"
test -n "$SIP_1002_PASSWORD"
envsubst < /templates/ari.conf.tpl > /etc/asterisk/ari.conf
envsubst < /templates/pjsip.conf.tpl > /etc/asterisk/pjsip.conf
exec asterisk -f -vvv
