#!/bin/bash

# Start the Django backend server
uvicorn --app-dir=/app --host=0.0.0.0 --timeout-graceful-shutdown=300 --limit-max-requests=20000 --lifespan=off impress.asgi:application &

# Start the Y provider service
cd src/frontend/servers/y-provider && PORT=4444 ${NODE_BIN:-node} dist/start-server.js &

# Start the Nginx server
bin/run &

# if the current shell is killed, also terminate all its children
trap "pkill SIGTERM -P $$" SIGTERM

# wait for a single child to finish,
wait -n
# then kill all the other tasks
pkill -P $$
