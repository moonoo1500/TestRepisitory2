import os

def test_smoke():
    # check main scene exists and is parseable
    main_path = "scenes/main.tscn"
    assert os.path.exists(main_path), "main.tscn missing"
    with open(main_path, encoding="utf-8") as f:
        content = f.read()
    assert "Main" in content
    assert "Godot" in content or "gd_scene" in content

    # check project.godot
    assert os.path.exists("project.godot")
    with open("project.godot", encoding="utf-8") as f:
        proj = f.read()
    assert "config_version=5" in proj
    assert "shatterline" in proj.lower() or "КРОШЕВО" in proj

    # check export_presets
    assert os.path.exists("export_presets.cfg")
    with open("export_presets.cfg", encoding="utf-8") as f:
        exp = f.read()
    assert "Android" in exp
    assert "arm64-v8a" in exp

    # check required scenes
    required = [
        "scenes/player/player.tscn",
        "scenes/levels/tutorial.tscn",
        "scenes/levels/level_01_factory.tscn",
        "scenes/levels/level_02_port.tscn",
        "scenes/levels/level_03_dome.tscn",
        "scenes/levels/level_04_final.tscn",
        "scenes/levels/sandbox.tscn",
        "scenes/levels/benchmark.tscn",
        "scenes/ui/hud.tscn",
        "scenes/ui/mission_select.tscn",
    ]
    for p in required:
        assert os.path.exists(p), f"missing {p}"

    # check voxel scripts exist
    for p in [
        "src/core/voxel/voxel_chunk.gd",
        "src/core/voxel/voxel_grid.gd",
        "src/core/voxel/voxel_material.gd",
        "src/core/game_state.gd",
        "src/core/save_system.gd",
    ]:
        assert os.path.exists(p), f"missing {p}"

    print("test_smoke PASSED")

if __name__ == "__main__":
    test_smoke()
