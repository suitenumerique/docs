import asyncio
from hypercorn import Config
from hypercorn.asyncio import serve
from pycrdt import Channel, Decoder, write_message
from pycrdt.websocket import ASGIServer, WebsocketServer


class MyWebsocket(Channel):
    def __init__(self, websocket: Channel):
        self._websocket = websocket
        self._room_id = websocket.query_params[b"room"][0]

    @property
    def path(self) -> str:
        return self._websocket.path

    def __aiter__(self) -> "Channel":
        return self

    async def __anext__(self) -> bytes:
        return await self.recv()

    async def send(self, message: bytes) -> None:
        my_message = write_message(self._room_id) + message
        return await self._websocket.send(my_message)

    async def recv(self) -> bytes:
        my_message = await self._websocket.recv()
        decoder = Decoder(my_message)
        decoder.read_message()
        message = my_message[decoder.i0:]
        return message


class MyWebsocketServer(WebsocketServer):
    async def serve(self, websocket: Channel) -> None:
        my_websocket = MyWebsocket(websocket)
        await super().serve(my_websocket)


async def main():
    websocket_server = MyWebsocketServer()
    app = ASGIServer(websocket_server)
    config = Config()
    config.bind = ["localhost:4444"]
    async with websocket_server:
        await serve(app, config, mode="asgi")

asyncio.run(main())
