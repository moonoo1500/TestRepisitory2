import json, os

def test_localization():
    ru_path = "localization/ru.json"
    en_path = "localization/en.json"
    assert os.path.exists(ru_path)
    assert os.path.exists(en_path)
    with open(ru_path, encoding="utf-8") as f:
        ru = json.load(f)
    with open(en_path, encoding="utf-8") as f:
        en = json.load(f)
    assert len(ru) > 0
    assert len(en) > 0
    # keys must match
    ru_keys = set(ru.keys())
    en_keys = set(en.keys())
    missing_ru = en_keys - ru_keys
    missing_en = ru_keys - en_keys
    assert not missing_ru, f"missing ru keys: {missing_ru}"
    assert not missing_en, f"missing en keys: {missing_en}"
    # no empty strings
    for k,v in ru.items():
        assert v.strip() != "", f"ru empty {k}"
    for k,v in en.items():
        assert v.strip() != "", f"en empty {k}"
    # count
    assert len(ru) >= 40, f"expected at least 40 keys, got {len(ru)}"
    # specific keys
    for k in ["menu.title","hud.tool","mission.m1.title","tool.hammer"]:
        assert k in ru, f"missing key {k}"
    print(f"test_localization PASSED — {len(ru)} keys")

if __name__ == "__main__":
    test_localization()
