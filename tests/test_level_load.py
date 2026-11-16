import json, os, glob

def test_level_load():
    level_files = glob.glob("levels/data/*.json")
    assert len(level_files) >= 6, f"expected at least 6 levels, got {level_files}"
    required = ["tutorial","m1_factory","m2_port","m3_dome","m4_final","sandbox"]
    for req in required:
        path = f"levels/data/{req}.json"
        assert os.path.exists(path), f"missing {path}"
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        assert "id" in data, f"{path} missing id"
        assert data["id"] == req, f"{path} id mismatch"
        assert "world_size" in data
        assert "voxels" in data
        assert isinstance(data["voxels"], list)
        for v in data["voxels"]:
            assert "from" in v and "to" in v and "mat" in v
            assert len(v["from"])==3 and len(v["to"])==3
            assert 0 <= v["mat"] <= 7
        assert "spawns" in data
        # objectives may be empty for sandbox
        assert "objectives" in data
    print("test_level_load PASSED")

if __name__ == "__main__":
    test_level_load()
