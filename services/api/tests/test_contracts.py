from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))

from generate_contracts import render_contracts  # noqa: E402


def test_generated_typescript_contracts_match_pydantic_models() -> None:
    expected = render_contracts()
    targets = (
        ROOT / "packages/types/src/generated.ts",
        ROOT.parent / "shaktios-app/src/types/contracts.ts",
    )
    for target in targets:
        assert target.read_text(encoding="utf-8") == expected, f"Regenerate stale contract: {target}"
