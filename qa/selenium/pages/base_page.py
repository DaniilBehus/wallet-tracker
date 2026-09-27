"""What every screen has, and the only ways this suite finds and waits for things.

Locators come from data-testid attributes, which the app keeps for exactly this
(spec §5), so a restyle or a moved element does not break a test that did not
change behaviour. Every wait is an explicit WebDriverWait on a condition; the
implicit wait stays 0 (conftest.py), so a missing element fails at the line
that needed it instead of stretching every lookup.
"""

from __future__ import annotations

from selenium.common.exceptions import StaleElementReferenceException
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


WAIT_SECONDS = 10


def testid(name: str) -> tuple[str, str]:
    """The suite's first choice of locator: an element by its data-testid."""
    return (By.CSS_SELECTOR, f'[data-testid="{name}"]')


def testid_prefix(prefix: str) -> tuple[str, str]:
    """Every element whose data-testid starts with `prefix`, such as one per row."""
    return (By.CSS_SELECTOR, f'[data-testid^="{prefix}"]')


def words(element: WebElement) -> str:
    """The element's text with the app's non-breaking spaces made plain."""
    return element.text.replace(" ", " ").strip()


class BasePage:
    TOAST_SUCCESS = testid("toast-success")
    TOAST_ERROR = testid("toast-error")
    # The failed request's reference under an error message (docs/support).
    TOAST_ERROR_REF = testid("toast-error-ref")
    NAV = {
        "add": testid("nav-add"),
        "month": testid("nav-month"),
        "upcoming": testid("nav-upcoming"),
        "schedules": testid("nav-schedules"),
    }

    def __init__(self, driver: WebDriver):
        self.driver = driver
        # A list the app redraws can leave a found element stale mid-check;
        # the condition is then simply asked again.
        self.wait = WebDriverWait(driver, WAIT_SECONDS, ignored_exceptions=(StaleElementReferenceException,))

    # --- finding and waiting -------------------------------------------------

    def visible(self, locator: tuple[str, str]) -> WebElement:
        return self.wait.until(EC.visibility_of_element_located(locator))

    def click(self, locator: tuple[str, str]) -> None:
        """Bring the element clear of the fixed bottom navigation, then click it.

        WebDriver scrolls only as far as the edge of the view, where the
        navigation, fixed over every screen, can sit on top of the element; a
        person would scroll it clear first. The click itself is a real one, so
        an element nothing can uncover still fails here.
        """
        element = self.wait.until(EC.element_to_be_clickable(locator))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        element.click()

    def type_into(self, locator: tuple[str, str], text: str) -> None:
        field = self.visible(locator)
        field.clear()
        field.send_keys(text)

    def text_of(self, locator: tuple[str, str]) -> str:
        return words(self.visible(locator))

    def wait_for_text(self, locator: tuple[str, str], expected: str) -> str:
        """Wait until the element reads exactly `expected`, and return it."""
        self.wait.until(
            lambda _: words(self.driver.find_element(*locator)) == expected,
            f"{locator[1]} never read {expected!r}",
        )
        return expected

    def wait_hidden(self, locator: tuple[str, str]) -> None:
        self.wait.until(EC.invisibility_of_element_located(locator))

    def count(self, locator: tuple[str, str]) -> int:
        return len(self.driver.find_elements(*locator))

    def css(self, locator: tuple[str, str], prop: str) -> str:
        """A computed style of the element, as the browser resolved it."""
        return self.visible(locator).value_of_css_property(prop)

    # --- shared parts of every screen -----------------------------------------

    def go_to(self, screen: str) -> None:
        self.click(self.NAV[screen])

    def use_phone_width(self, width: int = 375, height: int = 812) -> int:
        """Emulate a phone screen through Chrome's DevTools and return the page's width.

        Emulation rather than a window size: a desktop window cannot be made
        narrower than about 500 px when it is shown with --headed.
        """
        self.driver.execute_cdp_cmd(
            "Emulation.setDeviceMetricsOverride",
            {"width": width, "height": height, "deviceScaleFactor": 2, "mobile": True},
        )
        return self.driver.execute_script("return window.innerWidth;")

    def error_message(self) -> str:
        return self.text_of(self.TOAST_ERROR)

    def error_reference(self) -> str:
        return self.text_of(self.TOAST_ERROR_REF)

    def wait_for_success(self) -> None:
        self.visible(self.TOAST_SUCCESS)
