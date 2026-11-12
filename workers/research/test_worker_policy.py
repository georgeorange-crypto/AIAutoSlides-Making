import unittest
from unittest.mock import patch

from worker import allowed_page_request, assert_public_host, robots_allows


class CrawlNetworkPolicyTests(unittest.TestCase):
    def test_robots_policy_allows_article_and_denies_api_path(self):
        policy = """User-agent: *
Disallow: /w/
Disallow: /api/
Disallow: /trap/
Disallow: /wiki/Special:
"""
        self.assertTrue(robots_allows(policy, "https://en.wikipedia.org/wiki/Robots_exclusion_standard"))
        self.assertFalse(robots_allows(policy, "https://en.wikipedia.org/w/api.php?action=query"))

    def test_only_same_origin_https_requests_are_allowed(self):
        self.assertTrue(allowed_page_request("https://example.org/article", "example.org"))
        self.assertFalse(allowed_page_request("http://example.org/article", "example.org"))
        self.assertFalse(allowed_page_request("https://cdn.example.org/image", "example.org"))
        self.assertFalse(allowed_page_request("https://example.org:444/article", "example.org"))
        self.assertFalse(allowed_page_request("https://user@example.org/article", "example.org"))

    def test_public_dns_is_accepted_and_private_or_mixed_dns_is_rejected(self):
        resolver = lambda _host, _port: [(None, None, None, None, ("93.184.216.34", 443))]
        self.assertEqual(assert_public_host("example.org", resolver), {"93.184.216.34"})
        private = lambda _host, _port: [(None, None, None, None, ("127.0.0.1", 443))]
        with self.assertRaisesRegex(ValueError, "non-public"):
            assert_public_host("example.org", private)
        mixed = lambda _host, _port: [
            (None, None, None, None, ("93.184.216.34", 443)),
            (None, None, None, None, ("10.0.0.8", 443)),
        ]
        with self.assertRaisesRegex(ValueError, "non-public"):
            assert_public_host("example.org", mixed)

    def test_explicit_outbound_gateway_range_is_required_for_private_resolution(self):
        resolver = lambda _host, _port: [(None, None, None, None, ("10.20.1.5", 443))]
        with patch.dict("os.environ", {"AIAUTOSLIDES_EGRESS_CIDRS": "10.20.0.0/16"}):
            self.assertEqual(assert_public_host("proxy.example.org", resolver), {"10.20.1.5"})


if __name__ == "__main__":
    unittest.main()
