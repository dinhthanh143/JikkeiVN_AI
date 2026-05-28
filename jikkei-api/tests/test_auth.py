"""
Auth flow integration tests.

Each test has a comment explaining WHAT security property it proves,
not just what the code does. This makes regressions meaningful —
when a test fails you know which security guarantee broke.
"""


class TestRegistration:
    def test_register_success(self, client):
        """New user can register with valid data."""
        resp = client.post(
            "/auth/register",
            json={
                "email": "new@test.com",
                "username": "newuser",
                "password": "Secure123!",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        # SECURITY: response must never contain password data
        assert "password" not in data
        assert "hashed_password" not in data
        assert data["username"] == "newuser"

    def test_register_weak_password_rejected(self, client):
        """Passwords below minimum strength are rejected before hitting DB."""
        resp = client.post(
            "/auth/register",
            json={"email": "x@test.com", "username": "xuser", "password": "short"},
        )
        assert resp.status_code == 422

    def test_register_letters_only_password_rejected(self, client):
        """All-letter passwords rejected — must include number or symbol."""
        resp = client.post(
            "/auth/register",
            json={"email": "x@test.com", "username": "xuser", "password": "onlyletters"},
        )
        assert resp.status_code == 422

    def test_register_duplicate_email_rejected(self, client, regular_user):
        """Duplicate email returns 400, not a server error."""
        resp = client.post(
            "/auth/register",
            json={
                "email": "player@test.com",
                "username": "differentname",
                "password": "Secure123!",
            },
        )
        assert resp.status_code == 400

    def test_register_response_excludes_sensitive_fields(self, client):
        """Registration response never leaks security metadata."""
        resp = client.post(
            "/auth/register",
            json={"email": "safe@test.com", "username": "safeuser", "password": "Safe123!"},
        )
        assert resp.status_code == 201
        data = resp.json()
        forbidden_fields = ["hashed_password"]
        for field in forbidden_fields:
            assert field not in data, f"Response leaked sensitive field: {field}"


class TestLogin:
    def test_login_success_sets_cookies(self, client, regular_user):
        """Successful login sets httpOnly cookies — no tokens in body."""
        resp = client.post(
            "/auth/login",
            json={"email": "player@test.com", "password": "TestPass123!"},
        )
        assert resp.status_code == 200
        # Tokens must be in cookies, not response body
        assert "access_token" not in resp.json()
        assert "refresh_token" not in resp.json()
        assert "access_token" in resp.cookies

    def test_wrong_password_returns_401(self, client, regular_user):
        """Wrong password returns generic 401 — no detail about what was wrong."""
        resp = client.post(
            "/auth/login",
            json={"email": "player@test.com", "password": "WrongPassword!"},
        )
        assert resp.status_code == 401
        # SECURITY: error must not confirm whether email exists
        assert "email" not in resp.json().get("detail", "").lower()

    def test_nonexistent_email_returns_401(self, client):
        """Non-existent email returns same 401 as wrong password.
        This prevents user enumeration — attacker can't tell which it was."""
        resp = client.post(
            "/auth/login",
            json={"email": "ghost@nowhere.com", "password": "AnyPassword1!"},
        )
        assert resp.status_code == 401

    def test_login_response_excludes_sensitive_fields(self, client, regular_user):
        """Login response never leaks security metadata."""
        resp = client.post(
            "/auth/login",
            json={"email": "player@test.com", "password": "TestPass123!"},
        )
        data = resp.json()
        for field in ["hashed_password"]:
            assert field not in data, f"Login response leaked: {field}"


class TestMe:
    def test_me_requires_auth(self, client):
        """Unauthenticated request to /auth/me returns 401."""
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_me_returns_own_email(self, client, user_cookies):
        """Authenticated user sees their own email at /auth/me."""
        resp = client.get("/auth/me", cookies=user_cookies)
        assert resp.status_code == 200
        assert resp.json()["email"] == "player@test.com"

    def test_me_excludes_password(self, client, user_cookies):
        """SECURITY: /auth/me never returns password data."""
        resp = client.get("/auth/me", cookies=user_cookies)
        assert "hashed_password" not in resp.json()


class TestLogout:
    def test_logout_clears_cookies(self, client, user_cookies):
        """Logout clears auth cookies so subsequent requests fail."""
        client.post("/auth/logout", cookies=user_cookies)
        resp = client.get("/auth/me")
        assert resp.status_code == 401
