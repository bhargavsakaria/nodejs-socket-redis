#!/usr/bin/env bash

pm2 stop digihappy-backend || echo "stopped"
pm2 delete digihappy-backend  || echo "removed"