import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from flow_audit import audit_source, formatted_tokens, token_counts


class FlowAuditTests(unittest.TestCase):
    def test_docstrings_comments_are_excluded_and_sum_is_exact(self):
        source = '''"""documentation"""
# comment
import manimgx as m

class Scene(m.Scene):
    def construct(self):
        self.wait(2)
'''
        data = audit_source(source)
        self.assertEqual(data["source_lines"], 4)
        self.assertEqual(sum(data["classes"].values()), 4)

    def test_math_and_animation_are_separate(self):
        source = '''import manimgx as m
class Scene(m.Scene):
    def construct(self):
        formula = m.MathTex(r"x^2=4")
        self.play(m.Write(formula))
'''
        rows = audit_source(source)["lines"]
        self.assertEqual(rows[-2]["kind"], "math")
        self.assertEqual(rows[-1]["kind"], "choreography")

    def test_boilerplate_excluded_but_body_counted(self):
        source = '''import manimgx as m
class Demo(m.Scene):
    def construct(self):
        self.play(m.Write(m.Text("Hello")))
'''
        counted = token_counts(source)
        self.assertLess(counted["author_tokens"], counted["raw_tokens"])
        self.assertGreater(counted["author_tokens"], 5)

    def test_long_literal_is_visible(self):
        counted = token_counts('data = "THIS IS A LARGE STRING"\n')
        self.assertGreater(counted["literal_chars"], 20)

    def test_never_executes_user_python(self):
        source = 'import os\nos.system("echo SHOULD_NOT_RUN")\n'
        self.assertEqual(audit_source(source)["source_lines"], 2)

    def test_syntax_errors_are_reported(self):
        with self.assertRaises(SyntaxError):
            audit_source('def broken(:\n pass\n')

    def test_formatter_unavailable_fails_closed(self):
        with patch("flow_audit.shutil.which", return_value=None):
            with self.assertRaisesRegex(RuntimeError, "unavailable"):
                formatted_tokens("x=2\n", "source.py")

    def test_wrong_version_rejected(self):
        with patch("flow_audit.shutil.which", return_value="/usr/bin/ruff"), patch(
            "flow_audit.subprocess.run",
            return_value=subprocess.CompletedProcess([], 0, "ruff 0.13.0\n", "")
        ):
            with self.assertRaisesRegex(RuntimeError, "version mismatch"):
                formatted_tokens("x=2\n", "source.py")

    def test_formatter_normalization_is_measured(self):
        def fake_run(args, **kwargs):
            if "--version" in args:
                return subprocess.CompletedProcess(args, 0, "ruff 0.14.6\n", "")
            return subprocess.CompletedProcess(args, 0, "x = 2\n", "")
        with patch("flow_audit.shutil.which", return_value="/usr/bin/ruff"), patch(
            "flow_audit.subprocess.run", side_effect=fake_run
        ):
            a = formatted_tokens("x=2\n", "source.py")
            b = formatted_tokens("x = 2\n", "source.py")
        self.assertEqual(a["author_tokens"], b["author_tokens"])
        self.assertEqual(a["formatted_sha256"], b["formatted_sha256"])
        self.assertEqual(a["formatter"], "ruff 0.14.6")


if __name__ == "__main__":
    unittest.main()
