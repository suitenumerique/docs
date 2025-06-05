FROM python:3.13

USER root
RUN pip install hypercorn
RUN pip install git+https://github.com/davidbrochart/pycrdt-websocket.git@query-params

USER 1000

COPY ./src/backend/servers/y-provider/server.py .
#COPY ./server.py .

CMD python server.py

