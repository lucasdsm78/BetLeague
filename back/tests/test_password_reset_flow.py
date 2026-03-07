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
