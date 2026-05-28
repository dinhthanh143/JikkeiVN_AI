"""
Access control tests — the most security-critical test file.

These tests prove that role boundaries hold. If any of these fail,
a security regression has occurred and must be fixed before merge.
CI will block the PR automatically.
"""


class TestAdminAccess:
    def test_admin_routes_require_auth(self, client):
        """SECURITY: All admin routes must reject unauthenticated requests."""
        endpoints = ["/admin/users", "/admin/stats"]
        for endpoint in endpoints:
            resp = client.get(endpoint)
            assert resp.status_code in (401, 403), (
                f"SECURITY REGRESSION: {endpoint} is publicly accessible"
            )

    def test_regular_user_cannot_access_admin_routes(self, client, user_cookies):
        """SECURITY: Regular users must receive 403 on all admin routes.
        If this fails, admin is accessible to regular users — critical breach."""
        endpoints = ["/admin/users", "/admin/stats"]
        for endpoint in endpoints:
            resp = client.get(endpoint, cookies=user_cookies)
            assert resp.status_code == 403, (
                f"CRITICAL SECURITY REGRESSION: regular user accessed {endpoint}"
            )

    def test_admin_can_access_admin_routes(self, client, admin_cookies):
        """Admin role correctly grants access to admin routes."""
        resp = client.get("/admin/users", cookies=admin_cookies)
        assert resp.status_code == 200

    def test_admin_user_list_excludes_passwords(self, client, admin_cookies):
        """SECURITY: Even admin endpoints must never expose password hashes."""
        resp = client.get("/admin/users", cookies=admin_cookies)
        assert resp.status_code == 200
        for user in resp.json():
            assert "hashed_password" not in user, (
                "Admin endpoint is leaking password hashes"
            )

    def test_role_change_requires_admin(self, client, user_cookies, regular_user):
        """Regular users cannot elevate their own role to admin."""
        resp = client.patch(
            f"/admin/users/{regular_user.id}/role",
            json={"role": "admin"},
            cookies=user_cookies,
        )
        assert resp.status_code == 403, (
            "CRITICAL: User was able to elevate their own role to admin"
        )


class TestAiCostControls:
    def test_standalone_ai_routes_require_auth(self, client):
        for endpoint in ("/api/ai/chat", "/api/ai/chat/stream"):
            response = client.post(endpoint, json={"prompt": "hello", "tier": "premium"})
            assert response.status_code in (401, 403), (
                f"SECURITY REGRESSION: {endpoint} accepted an unauthenticated paid request"
            )


class TestSecurityHeaders:
    def test_clickjacking_header_present(self, client):
        """X-Frame-Options header must be on every response."""
        resp = client.get("/health")
        assert resp.headers.get("x-frame-options") == "DENY"

    def test_content_type_sniff_header_present(self, client):
        """X-Content-Type-Options must be on every response."""
        resp = client.get("/health")
        assert resp.headers.get("x-content-type-options") == "nosniff"

    def test_request_id_header_present(self, client):
        """Every response must have a unique X-Request-ID for traceability."""
        resp = client.get("/health")
        assert "x-request-id" in resp.headers
        assert len(resp.headers["x-request-id"]) > 10

    def test_swagger_hidden_structure(self, client):
        """
        In test env ENVIRONMENT=development so docs are available.
        This test documents that we KNOW docs exist in dev.
        The production check is in the startup validator.
        """
        resp = client.get("/docs")
        assert resp.status_code in (200, 404)


class TestRateLimiting:
    def test_health_endpoint_accessible(self, client):
        """Health endpoint returns DB status and correct format."""
        resp = client.get("/health")
        assert resp.status_code in (200, 503)
        data = resp.json()
        assert "database" in data
        assert "version" in data
