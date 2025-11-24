"""Test prometheus metrics CIDR protection of impress's core app."""

from django.test import TestCase
from django.test.utils import override_settings


class PrometheusCidrProtectionTest(TestCase):
    def test_prometheus_cidr_protection(self):
        """
        Adopts the same 12-scenario style from the ProbesCidrProtectionTest,
        but applies it to /prometheus/ using MONITORING_PROMETHEUS_EXPORTER and
        MONITORING_ALLOWED_CIDR_RANGES.

        We'll check for either 403 with specific messages,
        or 200 with a known metric in the response (e.g., 'process_virtual_memory_bytes').
        """

        scenarios = [
            # 1) MONITORING_PROMETHEUS_EXPORTER=True => No CIDR => 403
            {
                "name": "No CIDR => 403 + 'No allowed CIDR ranges configured.'",
                "settings": {
                    "MONITORING_PROMETHEUS_EXPORTER": True,
                    "MONITORING_ALLOWED_CIDR_RANGES": [],
                },
                "remote_addr": "127.0.0.1",
                "expected_status": 403,
                "expected_text": "No allowed CIDR ranges configured.",
            },
            # 2) MONITORING_PROMETHEUS_EXPORTER=True => CIDR=172.19.0.0/16 => IP outside => 403
            {
                "name": "CIDR='172.19.0.0/16' => IP outside => 403 => 'Access denied'",
                "settings": {
                    "MONITORING_PROMETHEUS_EXPORTER": True,
                    "MONITORING_ALLOWED_CIDR_RANGES": ["172.19.0.0/16"],
                },
                "remote_addr": "127.0.0.1",
                "expected_status": 403,
                "expected_text": "Access denied: Your IP is not allowed.",
            },
            # 3) MONITORING_PROMETHEUS_EXPORTER=True => CIDR='*' => any IP => 200 => known metric
            {
                "name": "CIDR='*' => any IP => 200 => 'process_virtual_memory_bytes'",
                "settings": {
                    "MONITORING_PROMETHEUS_EXPORTER": True,
                    "MONITORING_ALLOWED_CIDR_RANGES": ["*"],
                },
                "remote_addr": "8.8.8.8",
                "expected_status": 200,
                # We check for a known metric in the 200 response:
                "expected_text": "process_virtual_memory_bytes",
            },
            # 4) MONITORING_PROMETHEUS_EXPORTER=True => CIDR=172.19.0.0/16 => IP inside => 200
            {
                "name": "CIDR='172.19.0.0/16' => IP inside => 200 => known metric",
                "settings": {
                    "MONITORING_PROMETHEUS_EXPORTER": True,
                    "MONITORING_ALLOWED_CIDR_RANGES": ["172.19.0.0/16"],
                },
                "remote_addr": "172.19.0.2",
                "expected_status": 200,
                "expected_text": "process_virtual_memory_bytes",
            },
            # 5) MONITORING_PROMETHEUS_EXPORTER not set => no CIDR => 403
            {
                "name": "MONITORING_PROMETHEUS_EXPORTER not set => no CIDR => 403 => 'No allowed CIDR ranges configured.'",
                "settings": {
                    "MONITORING_PROMETHEUS_EXPORTER": False,
                    "MONITORING_ALLOWED_CIDR_RANGES": [],
                },
                "remote_addr": "127.0.0.1",
                "expected_status": 403,
                "expected_text": "No allowed CIDR ranges configured.",
            },
            # 6) MONITORING_PROMETHEUS_EXPORTER='False' => no CIDR => 403
            {
                "name": "MONITORING_PROMETHEUS_EXPORTER='False' => no CIDR => 403 => 'No allowed CIDR ranges configured.'",
                "settings": {
                    "MONITORING_PROMETHEUS_EXPORTER": False,
                    "MONITORING_ALLOWED_CIDR_RANGES": [],
                },
                "remote_addr": "127.0.0.1",
                "expected_status": 403,
                "expected_text": "No allowed CIDR ranges configured.",
            },
        ]

        for scenario in scenarios:
            with self.subTest(msg=scenario["name"]):
                with override_settings(**scenario["settings"]):
                    response = self.client.get(
                        "/prometheus/", REMOTE_ADDR=scenario["remote_addr"]
                    )

                    self.assertEqual(
                        scenario["expected_status"],
                        response.status_code,
                        f"Failed scenario: {scenario['name']}",
                    )

                    content = response.content.decode("utf-8")

                    self.assertIn(
                        scenario["expected_text"],
                        content,
                        f"Failed scenario: {scenario['name']}\n"
                        f"Response content:\n{content}",
                    )
