#!/bin/bash
while true; do
  cd /home/z/my-project/.next/standalone
  PORT=3000 NODE_ENV=production node server.js
  echo "Server crashed at $(date), restarting in 3s..." >> /home/z/my-project/server-crash.log
  sleep 3
done
