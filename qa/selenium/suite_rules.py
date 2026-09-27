"""The suite's waiting and locator rules, checked before any test runs.

Only explicit waits: no sleep, and no implicit wait other than zero. Locators
come from data-testid attributes, labels and roles, so XPath that counts
positions and CSS that follows the page's layout are refused. The reasons are
in qa/selenium/README.md.

The check reads the code rather than its text, so a comment or docstring that
names a forbidden call is not a violation.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path


# Written so that these patterns do not match their own source.
_POSITIONAL_XPATH = re.compile(r"\[\s*\d+\s*\]|position\(\)|last\(\)|sibling:{2}|ancestor:{2}|/\.\.")
# Combinators that pick by position: child, general sibling (not the ~= attribute
# operator) and adjacent sibling, and the nth- pseudo-classes.
_LAYOUT_CSS = re.compile(r"nth-(?:child|of-type|last-child|last-of-type)|>|~(?!=)|\s\+\s")


def violations(folder: Path) -> list[str]:
    """Every broken rule in the .py files under `folder`, as `file:line  reason`."""
    found = []
    for path in sorted(folder.rglob("*.py")):
        rel = path.relative_to(folder).as_posix()
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"), filename=str(path))):
            if isinstance(node, ast.Call):
                name = _called_name(node.func)
                if name in {"time.sleep", "sleep"}:
                    found.append(f"{rel}:{node.lineno}  a sleep; wait for a condition with WebDriverWait")
                if name.endswith("implicitly_wait") and not _is_zero(node.args):
                    found.append(f"{rel}:{node.lineno}  an implicit wait; it stays 0 and every wait is explicit")
            for how, text, line in _locators(node):
                if how == "XPATH" and _POSITIONAL_XPATH.search(text):
                    found.append(f"{rel}:{line}  a positional XPath: {text!r}")
                if how == "CSS_SELECTOR" and _LAYOUT_CSS.search(text):
                    found.append(f"{rel}:{line}  a CSS selector bound to the layout: {text!r}")
    return found


def _called_name(func: ast.expr) -> str:
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return f"{_called_name(func.value)}.{func.attr}"
    return ""


def _is_zero(args: list[ast.expr]) -> bool:
    return len(args) == 1 and isinstance(args[0], ast.Constant) and args[0].value == 0


def _locators(node: ast.AST):
    """(strategy, selector text, line) for each `By.X, "..."` pair in a tuple or a call."""
    items = node.elts if isinstance(node, ast.Tuple) else node.args if isinstance(node, ast.Call) else []
    for first, second in zip(items, items[1:]):
        if not (isinstance(first, ast.Attribute) and isinstance(first.value, ast.Name) and first.value.id == "By"):
            continue
        if isinstance(second, ast.Constant) and isinstance(second.value, str):
            yield first.attr, second.value, first.lineno
        elif isinstance(second, ast.JoinedStr):
            fixed = "".join(v.value for v in second.values if isinstance(v, ast.Constant))
            yield first.attr, fixed, first.lineno
