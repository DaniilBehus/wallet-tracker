"""Signing up and signing in, through the form a person uses."""

from __future__ import annotations

import re

from browser_logs import response_header
from case_link import case
from pages.add_page import AddPage
from pages.auth_page import AuthPage
from pages.month_page import MonthPage
from wallet_api import eur, new_credentials


@case("TC-SEL-001")
def test_registering_signs_in_on_the_add_screen_with_an_empty_month(driver, server, api):
    email, password = new_credentials()
    AuthPage(driver).open(server.base_url).register(email, password)

    # The app's default screen (spec §6.1), with the new account's categories:
    # the session the form created is the one the API knows.
    add = AddPage(driver).wait_until_open()
    token = driver.execute_script("return window.localStorage.getItem('wallet_token');")
    categories = api.get("/api/categories", headers={"Authorization": f"Bearer {token}"})
    assert categories.status_code == 200
    assert add.tile_count() == len(categories.json())

    month = MonthPage(driver).open()
    month.wait_for_text(month.TOTAL, eur(0))
    assert month.row_count() == 0


@case("TC-SEL-002")
def test_a_wrong_password_shows_the_message_and_its_reference(driver, server, account):
    auth = AuthPage(driver).open(server.base_url)
    auth.sign_in(account.email, f"not-{account.password}")

    assert auth.error_message() == "E-mail or password is incorrect."
    reference = auth.error_reference()
    assert re.fullmatch(r"[0-9a-f]{8}", reference), reference
    # The start of the refused response's request id, read off Chrome's network
    # log rather than taken from the screen it is meant to check.
    request_id = response_header(driver, "/api/auth/login", 401, "X-Request-Id")
    assert request_id.startswith(reference), f"reference {reference} is not the start of {request_id}"
