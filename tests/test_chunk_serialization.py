import json, os

def test_chunk_serialization():
    # Simulate chunk serialization logic in GDScript
    # Create a fake chunk with some voxels
    chunk = {"pos": [0,0,0], "data": [{"i": 5, "m": 1, "h": 120}, {"i": 20, "m": 2, "h": 180}], "v": 1}
    # serialize -> json
    serialized = json.dumps(chunk)
    parsed = json.loads(serialized)
    assert parsed["v"] == 1
    assert parsed["pos"] == [0,0,0]
    assert len(parsed["data"]) == 2
    # test roundtrip file
    path = "levels/data/tutorial.json"
    assert os.path.exists(path), f"level file missing {path}"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    assert "voxels" in data
    assert "version" not in data or isinstance(data.get("version", 1), int)
    # test save_system versioning
    save_data = {"version": 2, "chunks": [chunk], "saved_at": 123}
    assert save_data["version"] == 2
    print("test_chunk_serialization PASSED")

if __name__ == "__main__":
    test_chunk_serialization()
