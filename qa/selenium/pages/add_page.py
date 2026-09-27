"""Screen 6.1, the app's default screen: amount keypad, categories, note, save."""

from __future__ import annotations

from pages.base_page import BasePage, testid, testid_prefix


class AddPage(BasePage):
    AMOUNT = testid("amount-display")
    NOTE = testid("expense-note")
    SAVE = testid("expense-save-btn")
    TILES = testid_prefix("category-tile-")

    @staticmethod
    def key(digit: str) -> tuple[str, str]:
        return testid(f"keypad-{digit}")

    @staticmethod
    def tile(category_id: int) -> tuple[str, str]:
        return testid(f"category-tile-{category_id}")

    def wait_until_open(self) -> "AddPage":
        self.visible(self.AMOUNT)
        self.visible(self.TILES)
        return self

    def tile_count(self) -> int:
        return self.count(self.TILES)

    def add_expense(self, cents: int, category_id: int, note: str | None = None) -> None:
        """Type the amount as cents on the keypad ('740' is €7.40), pick a tile, save."""
        for digit in str(cents):
            self.click(self.key(digit))
        self.click(self.tile(category_id))
        if note is not None:
            self.type_into(self.NOTE, note)
        self.click(self.SAVE)
