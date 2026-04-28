import pytest


def test_password_reset_contract_models_importable():
    # smoke test: modules load
    from application.user.password_reset_models import (
        PasswordForgotRequest,
        PasswordForgotResponse,
        PasswordResetVerifyRequest,
        PasswordResetConfirmRequest,
    )

    assert PasswordForgotRequest
    assert PasswordForgotResponse
    assert PasswordResetVerifyRequest
    assert PasswordResetConfirmRequest


def test_password_forgot_response_exposes_ttl_seconds():
    from application.user.password_reset_models import PasswordForgotResponse

    response = PasswordForgotResponse(challenge_id='challenge-12345', expires_in_seconds=600)

    assert response.challenge_id == 'challenge-12345'
    assert response.expires_in_seconds == 600
