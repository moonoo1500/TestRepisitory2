def test_support():
    # Mock grid with is_supported logic: BFS to y=0 ground
    class MockGrid:
        def __init__(self, solids):
            self.solids = set(solids)
        def get_voxel(self, pos):
            return 1 if pos in self.solids else 0
        def is_supported(self, world):
            visited = set()
            queue = [world]
            visited.add(world)
            steps = 0
            while queue and steps < 512:
                cur = queue.pop(0)
                steps+=1
                if cur[1] <= 0:
                    return True
                for d in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]:
                    nb = (cur[0]+d[0], cur[1]+d[1], cur[2]+d[2])
                    if nb in visited: continue
                    if self.get_voxel(nb) != 0:
                        visited.add(nb)
                        queue.append(nb)
            return False

    # column to ground is supported
    grid = MockGrid([(0,1,0),(0,2,0),(0,3,0),(0,0,0)])
    assert grid.is_supported((0,3,0)) == True
    # floating island not supported
    grid2 = MockGrid([(5,5,5),(5,6,5)])
    assert grid2.is_supported((5,6,5)) == False
    # L-shaped connected to ground via side
    grid3 = MockGrid([(0,0,0),(1,0,0),(1,1,0),(1,2,0)])
    assert grid3.is_supported((1,2,0)) == True

    print("test_support PASSED")

if __name__ == "__main__":
    test_support()
