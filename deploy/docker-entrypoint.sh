#!/bin/sh
set -eu
if [ "$(id -u)" != "0" ]; then
  exec "$@"
fi
data="${SEEDLING_DATA_DIR:-/app/data}"
mkdir -p "$data"
find "$data" -xdev \( ! -uid 1000 -o ! -gid 1000 \) -exec chown -h 1000:1000 {} +
groups="1000"
if [ -S /var/run/docker.sock ]; then
  groups="$groups,$(stat -c %g /var/run/docker.sock)"
fi
exec env HOME=/home/node setpriv --reuid=1000 --regid=1000 --groups="$groups" --no-new-privs "$@"
