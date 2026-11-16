#!/usr/bin/env python3
import importlib.util, pathlib, sys, os

root = pathlib.Path(__file__).parent
sys.path.insert(0, str(root))

# change cwd to repo root for file paths
repo_root = root.parent
os.chdir(repo_root)

tests = [
    "test_chunk_serialization",
    "test_destruction_border",
    "test_support",
    "test_level_load",
    "test_localization",
    "test_save",
    "test_smoke",
]

failed = 0
for name in tests:
    print(f"\n=== {name} ===")
    try:
        spec = importlib.util.spec_from_file_location(name, root / f"{name}.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        # find test function: test_<name> without prefix or first
        func = None
        for attr in dir(mod):
            if attr.startswith("test_"):
                func = getattr(mod, attr)
                break
        if func:
            func()
        else:
            print(f"no test func in {name}")
            failed+=1
    except Exception as e:
        print(f"FAIL {name}: {e}")
        import traceback; traceback.print_exc()
        failed+=1

if failed==0:
    print(f"\n✅ All {len(tests)} tests PASSED")
    sys.exit(0)
else:
    print(f"\n❌ {failed}/{len(tests)} tests FAILED")
    sys.exit(1)
