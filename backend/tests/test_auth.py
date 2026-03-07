import pytest
from main import hash_password, verify_password

def test_hash_password():
    password = "secure_password123"
    hashed = hash_password(password)

    # Hash should not be the same as plain password
    assert hashed != password
    # Hash should be verifiable
    assert verify_password(password, hashed) is True

def test_verify_password_failure():
    password = "secure_password123"
    wrong_password = "wrong_password"
    hashed = hash_password(password)

    assert verify_password(wrong_password, hashed) is False

def test_hash_password_different_each_time():
    password = "secure_password123"
    hashed1 = hash_password(password)
    hashed2 = hash_password(password)

    # Salt should be different each time
    assert hashed1 != hashed2
    # Both should be valid for the same password
    assert verify_password(password, hashed1) is True
    assert verify_password(password, hashed2) is True

@pytest.mark.parametrize("password", [
    "",
    " ",
    "a" * 100,
    "!@#$%^&*()_+",
    "한글비밀번호",
])
def test_various_passwords(password):
    hashed = hash_password(password)
    assert verify_password(password, hashed) is True
