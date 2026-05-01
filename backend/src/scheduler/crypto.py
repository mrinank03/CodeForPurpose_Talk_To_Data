import os
import base64
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

# Require ENCRYPTION_KEY to be set, or generate a fallback one in development
_env_key = os.getenv("ENCRYPTION_KEY")

if not _env_key:
    # Development fallback
    _key = Fernet.generate_key()
else:
    # Ensure it's 32 url-safe base64-encoded bytes
    # Pad if necessary or let Fernet complain
    try:
        if len(_env_key) < 43:
            _padded = _env_key.ljust(43, "=")
        else:
            _padded = _env_key
        _key = _padded.encode('utf-8')
        # Validate by initializing
        Fernet(_key)
    except ValueError:
        # Generate a new one and print a warning
        print("WARNING: ENCRYPTION_KEY is invalid. Using a temporary generated key.")
        _key = Fernet.generate_key()

_cipher = Fernet(_key)

def encrypt_value(value: str) -> bytes:
    if not value:
        return b""
    return _cipher.encrypt(value.encode('utf-8'))

def decrypt_value(encrypted_value: bytes) -> str:
    if not encrypted_value:
        return ""
    return _cipher.decrypt(encrypted_value).decode('utf-8')
