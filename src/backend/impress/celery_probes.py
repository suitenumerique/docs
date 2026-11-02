"""
Health files of the Celery worker, read by the probes of its container.

The probes used to run `celery inspect ping`: a new Python process importing
Django for every check, plus a round trip through the broker. The worker now
writes two files instead and the probes only look at their age:

- the heartbeat file is touched by the timer of the worker's event loop, so it
  gets old when the loop is stuck;
- the ready file exists once the worker consumed from the broker a first time,
  for the startup probe.

The event loop does not run while the broker is unreachable: the worker blocks
on a hung connection or sleeps between reconnection attempts. The heartbeat
then gets old too, whatever this module does, so the liveness probe must
tolerate a broker outage of the length it is willing to wait for.
"""

from pathlib import Path

from django.conf import settings

from celery import bootsteps
from celery.signals import worker_ready, worker_shutdown


def heartbeat_file() -> Path:
    """Path of the file touched while the event loop of the worker runs."""
    return Path(settings.WORKER_HEARTBEAT_FILE)


def ready_file() -> Path:
    """Path of the file present while the worker consumes from the broker."""
    return Path(settings.WORKER_READY_FILE)


class HeartbeatStep(bootsteps.StartStopStep):
    """
    Touch the heartbeat file from the timer of the consumer's event loop.

    A consumer step, like the event heartbeat of Celery: after a connection
    loss Celery clears every entry of the timer and restarts the consumer
    steps, so `start` registers the entry again. A worker step would only be
    started once, and its heartbeat would stop after the first reconnection.
    """

    requires = {"celery.worker.consumer.tasks:Tasks"}

    def __init__(self, parent, **kwargs):
        super().__init__(parent, **kwargs)
        self.tref = None
        # Files left by a previous run, in a volume that outlived the container,
        # would make the probes succeed before this worker is up.
        heartbeat_file().unlink(missing_ok=True)
        ready_file().unlink(missing_ok=True)

    def start(self, parent):
        """Touch the file now, then at every interval."""
        self.beat()
        self.tref = parent.timer.call_repeatedly(
            settings.WORKER_HEARTBEAT_INTERVAL, self.beat, priority=10
        )

    def stop(self, parent):
        """Drop the timer entry: the consumer restarts or shuts down."""
        if self.tref is not None:
            self.tref.cancel()
            self.tref = None

    def shutdown(self, parent):
        """The worker is going away: remove the heartbeat file."""
        self.stop(parent)
        heartbeat_file().unlink(missing_ok=True)

    @staticmethod
    def beat():
        """Refresh the modification time of the heartbeat file."""
        heartbeat_file().touch()


@worker_ready.connect
def mark_ready(**_kwargs):
    """The worker consumes from the broker."""
    ready_file().touch()


@worker_shutdown.connect
def unmark_ready(**_kwargs):
    """The worker is shutting down."""
    ready_file().unlink(missing_ok=True)
