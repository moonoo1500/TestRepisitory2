import json, tempfile, os

def test_save():
    # simulate save_system roundtrip
    settings = {"language":"ru","quality":"Medium","sensitivity":1.0,"haptics":True}
    progress = {"completed":["tutorial"],"progress":{"tutorial":{"best_time":123,"stars":3}}}

    # save to temp
    with tempfile.TemporaryDirectory() as tmp:
        s_path = os.path.join(tmp, "settings.json")
        p_path = os.path.join(tmp, "progress.json")
        # save settings
        with open(s_path,"w",encoding="utf-8") as f:
            f.write(json.dumps(settings))
        # load
        with open(s_path,encoding="utf-8") as f:
            loaded = json.loads(f.read())
        assert loaded == settings
        # save progress
        with open(p_path,"w",encoding="utf-8") as f:
            f.write(json.dumps(progress))
        with open(p_path,encoding="utf-8") as f:
            loaded2 = json.loads(f.read())
        assert loaded2 == progress
        # level save with version
        level_state = {"version":2,"chunks":[{"pos":[0,0,0],"data":[{"i":5,"m":1,"h":120}]}],"saved_at":123}
        l_path = os.path.join(tmp, "m1_factory.json")
        with open(l_path,"w",encoding="utf-8") as f:
            f.write(json.dumps(level_state))
        with open(l_path,encoding="utf-8") as f:
            l_loaded = json.loads(f.read())
        assert l_loaded["version"] == 2
        assert len(l_loaded["chunks"]) == 1
    print("test_save PASSED")

if __name__ == "__main__":
    test_save()
