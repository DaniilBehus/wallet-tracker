"""Screen 6.2: the month total, the list of expenses, the limit and its status box."""

from __future__ import annotations

from pages.base_page import BasePage, testid, testid_prefix, words


class MonthPage(BasePage):
    TOTAL = testid("month-total")
    ROWS = testid_prefix("tx-row-")
    NAMES = testid_prefix("tx-name-")

    LIMIT_VALUE = testid("limit-value")
    LIMIT_EDIT = testid("limit-edit")
    LIMIT_INPUT = testid("limit-input")
    LIMIT_SAVE = testid("limit-save")
    # "Within limit · €… left", "Limit reached" or "Over limit by €…", in a box
    # whose look carries the same state (UAT-OBS-01).
    LIMIT_STATUS = testid("limit-status")
    # Must never be framed; the state lives in the status box.
    LIMIT_FIGURE = testid("limit-figure")
    CATEGORY_LIMIT_INPUT = testid("category-limit-input")
    CATEGORY_LIMIT_SAVE = testid("category-limit-save")

    @staticmethod
    def category_limit_edit(category_id: int) -> tuple[str, str]:
        return testid(f"category-limit-edit-{category_id}")

    @staticmethod
    def category_limit_status(category_id: int) -> tuple[str, str]:
        return testid(f"category-limit-status-{category_id}")

    def set_category_limit(self, category_id: int, figure: str) -> None:
        self.click(self.category_limit_edit(category_id))
        self.type_into(self.CATEGORY_LIMIT_INPUT, figure)
        self.click(self.CATEGORY_LIMIT_SAVE)
        self.wait_hidden(self.CATEGORY_LIMIT_INPUT)
        # The dialog closes before loadMonth() finishes. Wait for withBusy's
        # final re-enable too, or an immediate second submit can be ignored.
        self.wait.until(
            lambda _: self.driver.find_element(*self.CATEGORY_LIMIT_SAVE).is_enabled(),
            "category save did not finish refreshing the month",
        )

    EDIT_NOTE = testid("tx-edit-note")
    EDIT_SAVE = testid("tx-edit-save")

    @staticmethod
    def row(transaction_id: int) -> tuple[str, str]:
        return testid(f"tx-row-{transaction_id}")

    @staticmethod
    def edit_button(transaction_id: int) -> tuple[str, str]:
        """The row's own body, which is the control that opens the editor."""
        return testid(f"tx-edit-{transaction_id}")

    def open(self) -> "MonthPage":
        self.go_to("month")
        self.visible(self.TOTAL)
        return self

    def row_count(self) -> int:
        return self.count(self.ROWS)

    def wait_for_row_count(self, expected: int) -> None:
        self.wait.until(lambda _: self.row_count() == expected, f"the month never listed {expected} rows")

    def row_named(self, name: str) -> str:
        """The text of the one row whose main line reads `name`."""
        def find(_):
            for line in self.driver.find_elements(*self.NAMES):
                if words(line) == name:
                    return line.get_attribute("data-testid").removeprefix("tx-name-")
            return False

        transaction_id = self.wait.until(find, f"no row is named {name!r}")
        return self.text_of(self.row(int(transaction_id)))

    def edit_note(self, transaction_id: int, note: str) -> None:
        """Open the editor on one row, change only the note, save."""
        self.click(self.edit_button(transaction_id))
        self.type_into(self.EDIT_NOTE, note)
        self.click(self.EDIT_SAVE)
        self.wait_hidden(self.EDIT_NOTE)

    def set_limit(self, figure: str) -> None:
        """Open the limit editor, type a figure, save. An empty figure clears the limit."""
        self.click(self.LIMIT_EDIT)
        self.type_into(self.LIMIT_INPUT, figure)
        self.click(self.LIMIT_SAVE)

    def status_box(self) -> dict[str, str]:
        """How the status box is drawn right now, and the palette's two box colours."""
        box = self.visible(self.LIMIT_STATUS)
        tokens = self.driver.execute_script(
            "const root = getComputedStyle(document.documentElement);"
            "return [root.getPropertyValue('--limit-used-up'), root.getPropertyValue('--limit-outline')];"
        )
        return {
            "classes": box.get_attribute("class"),
            "fill": box.value_of_css_property("background-color"),
            "border": box.value_of_css_property("border-top-color"),
            "text": box.value_of_css_property("color"),
            "used_up": tokens[0].strip(),
            "outline": tokens[1].strip(),
        }

    def limit_figure_border(self) -> list[str]:
        return [self.css(self.LIMIT_FIGURE, f"border-{side}-width") for side in ("top", "right", "bottom", "left")]
