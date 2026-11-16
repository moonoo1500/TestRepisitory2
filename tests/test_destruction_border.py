def test_destruction_border():
    CHUNK_SIZE = 16
    def chunk_key_for_world(world):
        import math
        return tuple(math.floor(world[i]/CHUNK_SIZE) for i in range(3))
    def local_in_chunk(world):
        ck = chunk_key_for_world(world)
        return tuple(world[i] - ck[i]*CHUNK_SIZE for i in range(3))

    # border at x=15 should dirty neighbor chunk at +1
    world = (15, 5, 5)  # last voxel in chunk 0
    ck = chunk_key_for_world(world)
    local = local_in_chunk(world)
    assert local[0] == 15
    # neighbor marking logic: if local.x == CHUNK_SIZE-1 -> dirty ck+(1,0,0)
    dirty = set()
    if local[0] == 15:
        dirty.add((ck[0]+1, ck[1], ck[2]))
    assert (1,0,0) in dirty, "border should trigger neighbor dirty"

    # also test lower border
    world2 = (16,5,5) # first voxel of next chunk
    ck2 = chunk_key_for_world(world2)
    local2 = local_in_chunk(world2)
    assert local2[0] == 0
    dirty2 = set()
    if local2[0] == 0:
        dirty2.add((ck2[0]-1, ck2[1], ck2[2]))
    assert (0,0,0) in dirty2

    # explosion at border should handle multiple chunks
    # simple check: explosion radius 1 at (15,0,15) affects both chunks
    center = (15,0,15)
    radius = 1
    affected_chunks = set()
    for x in range(-radius, radius+1):
        for y in range(-radius, radius+1):
            for z in range(-radius, radius+1):
                if (x*x+y*y+z*z) > radius*radius:
                    continue
                p = (center[0]+x, center[1]+y, center[2]+z)
                affected_chunks.add(chunk_key_for_world(p))
    assert len(affected_chunks) >= 2, "explosion at border should span chunks"

    print("test_destruction_border PASSED")

if __name__ == "__main__":
    test_destruction_border()
