"""Safe scientific calculator.

Examples:
  python calc.py "sin(pi/2) + log10(100)"
"""

from __future__ import annotations

import argparse
import ast
import math
from typing import Any


ALLOWED_NAMES = {
    "pi": math.pi,
    "e": math.e,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "asin": math.asin,
    "acos": math.acos,
    "atan": math.atan,
    "sqrt": math.sqrt,
    "log": math.log,
    "log10": math.log10,
    "abs": abs,
    "pow": pow,
    "min": min,
    "max": max,
    "round": round,
}


def _eval_node(node: ast.AST) -> Any:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise ValueError("Only numbers are allowed")
    if isinstance(node, ast.BinOp):
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            return left / right
        if isinstance(node.op, ast.Pow):
            return left**right
        if isinstance(node.op, ast.Mod):
            return left % right
        raise ValueError("Unsupported operator")
    if isinstance(node, ast.UnaryOp):
        value = _eval_node(node.operand)
        if isinstance(node.op, ast.UAdd):
            return +value
        if isinstance(node.op, ast.USub):
            return -value
        raise ValueError("Unsupported unary operator")
    if isinstance(node, ast.Name):
        if node.id in ALLOWED_NAMES:
            return ALLOWED_NAMES[node.id]
        raise ValueError(f"Unknown symbol: {node.id}")
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name):
            raise ValueError("Only simple functions allowed")
        func = ALLOWED_NAMES.get(node.func.id)
        if func is None:
            raise ValueError(f"Unknown function: {node.func.id}")
        args = [_eval_node(arg) for arg in node.args]
        return func(*args)
    raise ValueError("Unsupported expression")


def safe_eval(expr: str) -> float:
    tree = ast.parse(expr, mode="eval")
    return float(_eval_node(tree))


def repl() -> None:
    print("SciCalc - type 'exit' to quit")
    while True:
        try:
            line = input(">>> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if not line:
            continue
        if line.lower() in {"exit", "quit"}:
            return
        try:
            print(safe_eval(line))
        except Exception as exc:  # noqa: BLE001
            print(f"error: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Safe scientific calculator")
    parser.add_argument("expr", nargs="?", help="Expression to evaluate")
    args = parser.parse_args()
    if args.expr:
        print(safe_eval(args.expr))
        return
    repl()


if __name__ == "__main__":
    main()
