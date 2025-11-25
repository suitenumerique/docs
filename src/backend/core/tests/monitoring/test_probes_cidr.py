"""Test liveness and readiness CIDR protected probes of impress's core app."""

from django.test import TestCase
from django.test.utils import override_settings


class ProbesCidrProtectionTest(TestCase):
    def test_probes_cidr_protection(self):
        """
        Tests that hitting the /probes/liveness/ or /probes/readiness/ endpoints
        returns 403 for disallowed IPs, 200 for allowed IPs (CIDR logic),
        and 403 if MONITORING_PROBING is not set or "False" (because no CIDR is configured).
        """

        scenarios = [
            # 1) No CIDR => 403 on liveness (MONITORING_PROBING="True")
            {
                "name": "No CIDR => 403 + 'No allowed CIDR ranges configured.' => liveness",
                "settings": {
                    "MONITORING_PROBING": True,
                    "MONITORING_ALLOWED_CIDR_RANGES": [],
                },
                "endpoint": "/probes/liveness/",
                "remote_addr": "127.0.0.1",
                "expected_status": 403,
                "expected_text": "No allowed CIDR ranges configured.",
            },
            # 2) No CIDR => 403 on readiness (MONITORING_PROBING="True")
            {
                "name": "No CIDR => 403 + 'No allowed CIDR ranges configured.' => readiness",
                "settings": {
                    "MONITORING_PROBING": True,
                    "MONITORING_ALLOWED_CIDR_RANGES": [],
                },
                "endpoint": "/probes/readiness/",
                "remote_addr": "127.0.0.1",
                "expected_status": 403,
                "expected_text": "No allowed CIDR ranges configured.",
            },
            # 3) CIDR=172.19.0.0/16 => IP outside => 403 on liveness
            {
                "name": "CIDR='172.19.0.0/16' => IP outside => 403 => liveness",
                "settings": {
                    "MONITORING_PROBING": True,
                    "MONITORING_ALLOWED_CIDR_RANGES": ["172.19.0.0/16"],
                },
                "endpoint": "/probes/liveness/",
                "remote_addr": "127.0.0.1",
                "expected_status": 403,
                "expected_text": "Access denied: Your IP is not allowed.",
            },
            # 4) CIDR=172.19.0.0/16 => IP outside => 403 on readiness
            {
                "name": "CIDR='172.19.0.0/16' => IP outside => 403 => readiness",
                "settings": {
                    "MONITORING_PROBING": True,
                    "MONITORING_ALLOWED_CIDR_RANGES": ["172.19.0.0/16"],
                },
                "endpoint": "/probes/readiness/",
                "remote_addr": "127.0.0.1",
                "expected_status": 403,
                "expected_text": "Access denied: Your IP is not allowed.",
            },
            # 5) CIDR='*' => any IP => 200 => liveness
            {
                "name": "CIDR='*' => any IP => 200 => liveness",
                "settings": {
                    "MONITORING_PROBING": True,
                    "MONITORING_ALLOWED_CIDR_RANGES": ["*"],
                },
                "endpoint": "/probes/liveness/",
                "remote_addr": "8.8.8.8",
                "expected_status": 200,
                "expected_text": "OK",
            },
            # 6) CIDR='*' => any IP => 200 => readiness
            {
                "name": "CIDR='*' => any IP => 200 => readiness",
                "settings": {
                    "MONITORING_PROBING": True,
                    "MONITORING_ALLOWED_CIDR_RANGES": ["*"],
                },
                "endpoint": "/probes/readiness/",
                "remote_addr": "8.8.8.8",
                "expected_status": 200,
                "expected_text": "OK",
            },
            # 7) CIDR=172.19.0.0/16 => IP inside => 200 => liveness
            {
                "name": "CIDR='172.19.0.0/16' => IP inside => 200 => liveness",
                "settings": {
                    "MONITORING_PROBING": True,
                    "MONITORING_ALLOWED_CIDR_RANGES": ["172.19.0.0/16"],
                },
                "endpoint": "/probes/liveness/",
                "remote_addr": "172.19.0.2",
                "expected_status": 200,
                "expected_text": "OK",
            },
            # 8) CIDR=172.19.0.0/16 => IP inside => 200 => readiness
            {
                "name": "CIDR='172.19.0.0/16' => IP inside => 200 => readiness",
                "settings": {
                    "MONITORING_PROBING": True,
                    "MONITORING_ALLOWED_CIDR_RANGES": ["172.19.0.0/16"],
                },
                "endpoint": "/probes/readiness/",
                "remote_addr": "172.19.0.2",
                "expected_status": 200,
                "expected_text": "OK",
            },
            # 9) MONITORING_PROBING not set => no CIDR => 403
            {
                "name": "MONITORING_PROBING not set => liveness => 403 => 'No allowed CIDR ranges configured.'",
                "settings": {
                    "MONITORING_PROBING": False,
                    "MONITORING_ALLOWED_CIDR_RANGES": [],
                },
                "endpoint": "/probes/liveness/",
                "remote_addr": "127.0.0.1",
                "expected_status": 403,
                "expected_text": "No allowed CIDR ranges configured.",
            },
            # 10) MONITORING_PROBING not set => readiness => 403
            {
                "name": "MONITORING_PROBING not set => readiness => 403 => 'No allowed CIDR ranges configured.'",
                "settings": {
                    "MONITORING_PROBING": False,
                    "MONITORING_ALLOWED_CIDR_RANGES": [],
                },
                "endpoint": "/probes/readiness/",
                "remote_addr": "127.0.0.1",
                "expected_status": 403,
                "expected_text": "No allowed CIDR ranges configured.",
            },
            # 11) MONITORING_PROBING='False' => no CIDR => 403
            {
                "name": 'MONITORING_PROBING="False" => liveness => 403 => "No allowed CIDR..."',
                "settings": {
                    "MONITORING_PROBING": False,
                    "MONITORING_ALLOWED_CIDR_RANGES": [],
                },
                "endpoint": "/probes/liveness/",
                "remote_addr": "127.0.0.1",
                "expected_status": 403,
                "expected_text": "No allowed CIDR ranges configured.",
            },
            # 12) MONITORING_PROBING='False' => readiness => 403
            {
                "name": 'MONITORING_PROBING="False" => readiness => 403 => "No allowed CIDR..."',
                "settings": {
                    "MONITORING_PROBING": False,
                    "MONITORING_ALLOWED_CIDR_RANGES": [],
                },
                "endpoint": "/probes/readiness/",
                "remote_addr": "127.0.0.1",
                "expected_status": 403,
                "expected_text": "No allowed CIDR ranges configured.",
            },
        ]

        for scenario in scenarios:
            with self.subTest(msg=scenario["name"]):
                with override_settings(**scenario["settings"]):
                    response = self.client.get(
                        scenario["endpoint"], REMOTE_ADDR=scenario["remote_addr"]
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
