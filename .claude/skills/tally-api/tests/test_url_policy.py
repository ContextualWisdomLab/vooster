"""Regression tests for the fixed Tally API network boundary."""

import ssl
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

import api_client
import submit_response


class TallyUrlPolicyTest(unittest.TestCase):
    """Keep every skill request on the exact Tally HTTPS origin."""

    def test_builds_api_url_on_fixed_origin(self) -> None:
        """Relative API paths and query values stay on api.tally.so."""
        self.assertEqual(
            api_client.build_api_url("/forms", {"limit": 1}),
            "https://api.tally.so/forms?limit=1",
        )

    def test_rejects_endpoint_that_changes_authority(self) -> None:
        """A userinfo-style endpoint cannot redirect credentials to another host."""
        with self.assertRaises(ValueError):
            api_client.build_api_url("@attacker.example/forms")

    def test_rejects_unsafe_form_identifier(self) -> None:
        """A form identifier cannot inject path or authority syntax."""
        with self.assertRaises(ValueError):
            submit_response.build_form_response_url("form/../../attacker")

    def test_tls_verification_remains_enabled(self) -> None:
        """Missing optional certificate packages never disables TLS verification."""
        self.assertTrue(api_client.SSL_CTX.check_hostname)
        self.assertEqual(api_client.SSL_CTX.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(submit_response.SSL_CTX.check_hostname)
        self.assertEqual(submit_response.SSL_CTX.verify_mode, ssl.CERT_REQUIRED)


if __name__ == "__main__":
    unittest.main()
