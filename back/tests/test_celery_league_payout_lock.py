from __future__ import annotations

import infrastructure.celery.tasks as tasks_module


def test_process_league_payout_task_skips_when_lock_is_already_held(monkeypatch):
    run_calls: list[object] = []
    release_calls: list[str] = []

    monkeypatch.setattr(tasks_module, "_league_payout_lock_key_and_ttl", lambda: ("betleague:test:lock", 30))
    monkeypatch.setattr(tasks_module, "_acquire_league_payout_task_lock", lambda *, owner_token: False)
    monkeypatch.setattr(tasks_module, "_release_league_payout_task_lock", lambda *, owner_token: release_calls.append(owner_token))
    monkeypatch.setattr(tasks_module, "_run_async", lambda coro: run_calls.append(coro))

    tasks_module.process_weekly_league_payouts._orig_run()

    assert run_calls == []
    assert release_calls == []


def test_process_league_payout_task_releases_lock_even_on_failure(monkeypatch):
    release_calls: list[str] = []

    monkeypatch.setattr(tasks_module, "_league_payout_lock_key_and_ttl", lambda: ("betleague:test:lock", 30))
    monkeypatch.setattr(tasks_module, "_acquire_league_payout_task_lock", lambda *, owner_token: True)
    monkeypatch.setattr(tasks_module, "_release_league_payout_task_lock", lambda *, owner_token: release_calls.append(owner_token))

    def _raise(coro):
        coro.close()
        raise RuntimeError("boom")

    monkeypatch.setattr(tasks_module, "_run_async", _raise)

    try:
        tasks_module.process_weekly_league_payouts._orig_run()
    except RuntimeError as exc:
        assert str(exc) == "boom"
    else:  # pragma: no cover
        raise AssertionError("RuntimeError expected")

    assert len(release_calls) == 1
    assert release_calls[0]



