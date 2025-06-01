#!/bin/bash

# Start the Django backend server
gunicorn -b :8000 impress.wsgi:application --log-file - &

# Start the Y provider service
cd src/frontend/servers/y-provider && PORT=4444 ../../.scalingo/node/bin/node dist/start-server.js &

# Start the Nginx server
bin/run &

# if the current shell is killed, also terminate all its children     
trap "pkill SIGTERM -P $$" SIGTERM                            
                                                                   
# wait for a single child to finish,                               
wait -n                                                  
# then kill all the other tasks                          
pkill -P $$
