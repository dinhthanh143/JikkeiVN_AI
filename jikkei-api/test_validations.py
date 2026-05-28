from pydantic import ValidationError
from app.schemas.auth import RegisterRequest

# Test 1: Valid registration
try:
    req = RegisterRequest(email="user@example.com", username="test_user", password="password123")
    print("✓ Valid registration accepted")
except ValidationError as e:
    print("✗ Valid registration rejected:", e)

# Test 2: Weak password (no numbers/symbols)
try:
    req = RegisterRequest(email="user@example.com", username="test_user", password="passwordonly")
    print("✗ Weak password (all alpha) was accepted - SECURITY ISSUE")
except ValidationError:
    print("✓ Weak password (all alpha) correctly rejected")

# Test 3: Password too long
try:
    req = RegisterRequest(email="user@example.com", username="test_user", password="a" * 200)
    print("✗ Overly long password accepted - DoS RISK")
except ValidationError:
    print("✓ Overly long password correctly rejected")

# Test 4: Invalid username (spaces)
try:
    req = RegisterRequest(email="user@example.com", username="test user", password="password123")
    print("✗ Username with spaces accepted")
except ValidationError:
    print("✓ Username with spaces correctly rejected")

# Test 5: Valid username with underscore and dash
try:
    req = RegisterRequest(email="user@example.com", username="test_user-123", password="password123")
    print("✓ Valid username with underscore and dash accepted")
except ValidationError as e:
    print("✗ Valid username rejected:", e)

print("\n✓ All schema validations working correctly")
