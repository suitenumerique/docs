"""Health files of the Celery worker, read by the probes of its container."""

import os
from unittest import mock

import pytest
from celery.signals import worker_ready, worker_shutdown

from impress.celery_app import app
from impress.celery_probes import HeartbeatStep


@pytest.fixture(name="probe_files")
def fixture_probe_files(settings, tmp_path):
    """Point the probe files to a temporary directory."""
    settings.WORKER_HEARTBEAT_FILE = str(tmp_path / "heartbeat")
    settings.WORKER_READY_FILE = str(tmp_path / "ready")
    settings.WORKER_HEARTBEAT_INTERVAL = 7
    return tmp_path / "heartbeat", tmp_path / "ready"


def test_celery_probes_step_is_registered():
    """The consumer of the project's worker runs the step, restarted on reconnection."""
    assert HeartbeatStep in app.steps["consumer"]


def test_celery_probes_step_removes_stale_files(probe_files):
    """Files left by a previous run must not make the probes succeed early."""
    heartbeat, ready = probe_files
    heartbeat.touch()
    ready.touch()

    HeartbeatStep(mock.Mock())

    assert not heartbeat.exists()
    assert not ready.exists()


def test_celery_probes_step_touches_the_heartbeat_file(probe_files):
    """The file is touched on start, then by the timer of the worker."""
    heartbeat, _ready = probe_files
    consumer = mock.Mock()
    step = HeartbeatStep(consumer)

    step.start(consumer)

    assert heartbeat.exists()
    consumer.timer.call_repeatedly.assert_called_once_with(7, step.beat, priority=10)

    os.utime(heartbeat, (0, 0))
    beat = consumer.timer.call_repeatedly.call_args.args[1]
    beat()
    assert heartbeat.stat().st_mtime > 0


def test_celery_probes_step_restart(probe_files):
    """
    A broker reconnection stops the consumer steps, after Celery cleared the
    timer, then starts them again: the entry is registered again and the file
    kept, as the probe must not fail on the reconnection itself.
    """
    heartbeat, _ready = probe_files
    consumer = mock.Mock()
    step = HeartbeatStep(consumer)
    step.start(consumer)
    first = consumer.timer.call_repeatedly.return_value

    step.stop(consumer)

    first.cancel.assert_called_once_with()
    assert heartbeat.exists()

    consumer.timer.call_repeatedly.reset_mock()
    step.start(consumer)
    consumer.timer.call_repeatedly.assert_called_once_with(7, step.beat, priority=10)


def test_celery_probes_step_shutdown(probe_files):
    """On shutdown the timer entry is cancelled and the heartbeat file removed."""
    heartbeat, _ready = probe_files
    consumer = mock.Mock()
    step = HeartbeatStep(consumer)
    step.start(consumer)
    tref = consumer.timer.call_repeatedly.return_value

    step.shutdown(consumer)

    tref.cancel.assert_called_once_with()
    assert not heartbeat.exists()

    # A stop after the shutdown, or a second shutdown, is harmless.
    step.stop(consumer)
    step.shutdown(consumer)
    tref.cancel.assert_called_once_with()


def test_celery_probes_ready_file(probe_files):
    """The ready file exists from the ready signal to the shutdown one."""
    _heartbeat, ready = probe_files

    worker_ready.send(sender=mock.Mock())
    assert ready.exists()

    worker_shutdown.send(sender=mock.Mock())
    assert not ready.exists()

    # The worker may shut down before it was ready.
    worker_shutdown.send(sender=mock.Mock())
