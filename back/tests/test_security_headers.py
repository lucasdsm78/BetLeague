from __future__ import annotations

from fastapi.testclient import TestClient

import main


client = TestClient(main.app)


def test_health_exposes_hardening_security_headers():
    response = client.get('/health', headers={'host': 'localhost'})

    assert response.status_code == 200
    assert response.headers['x-content-type-options'] == 'nosniff'
    assert response.headers['x-frame-options'] == 'DENY'
    assert response.headers['referrer-policy'] == 'strict-origin-when-cross-origin'
    assert response.headers['cross-origin-opener-policy'] == 'same-origin'
    assert response.headers['cross-origin-resource-policy'] == 'same-site'
    assert response.headers['x-permitted-cross-domain-policies'] == 'none'
    assert "frame-ancestors 'none'" in response.headers['content-security-policy']
