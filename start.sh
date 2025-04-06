#!/bin/bash
log_file="/var/log/bayareashows.log"
{
    echo "Starting bayareashows.com..."
    cd /app
    npm install
    npm run build
    npm run start
} 2>&1 | tee -a $log_file
