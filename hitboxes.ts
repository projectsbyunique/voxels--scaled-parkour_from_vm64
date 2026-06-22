function hitboxDirT(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    dx: number, dy: number, dz: number
): number[] {

    let tx = 1
    let ty = 1
    let tz = 1

    let hitMask = 0

    let curAx = ax
    let curAy = ay
    let curAz = az
    let curBx = bx
    let curBy = by
    let curBz = bz

    const EPS = 0.001

    // --- X movement ---
    if (dx !== 0) {
        let t = sweepAABB(curAx, curAy, curAz, curBx, curBy, curBz, dx, 0, 0)
        if (t < 1) {
            hitMask |= 1
            // back off a tiny bit so we don't end up exactly on the face
            const mag = Math.abs(dx)
            if (mag > 0) t = Math.max(0, t - EPS / mag)
        }
        tx = t
        curAx += dx * t
        curBx += dx * t
    }

    // --- Y movement ---
    if (dy !== 0) {
        let t = sweepAABB(curAx, curAy, curAz, curBx, curBy, curBz, 0, dy, 0)
        if (t < 1) {
            hitMask |= 2
            const mag = Math.abs(dy)
            if (mag > 0) t = Math.max(0, t - EPS / mag)
        }
        ty = t
        curAy += dy * t
        curBy += dy * t
    }

    // --- Z movement ---
    if (dz !== 0) {
        let t = sweepAABB(curAx, curAy, curAz, curBx, curBy, curBz, 0, 0, dz)
        if (t < 1) {
            hitMask |= 4
            const mag = Math.abs(dz)
            if (mag > 0) t = Math.max(0, t - EPS / mag)
        }
        tz = t
        curAz += dz * t
        curBz += dz * t
    }

    return [tx, ty, tz, hitMask]
}



function sweepAABB(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    dx: number, dy: number, dz: number
): number {

    // Swept AABB bounds
    let minX = ax < ax + dx ? ax : ax + dx
    let maxX = bx > bx + dx ? bx : bx + dx
    let minY = ay < ay + dy ? ay : ay + dy
    let maxY = by > by + dy ? by : by + dy
    let minZ = az < az + dz ? az : az + dz
    let maxZ = bz > bz + dz ? bz : bz + dz

    // Clamp to world
    if (minX < 0) minX = 0
    if (minY < 0) minY = 0
    if (minZ < 0) minZ = 0

    let minXi = Math.floor(minX)
    let minYi = Math.floor(minY)
    let minZi = Math.floor(minZ)

    let maxXi = Math.ceil(maxX)
    let maxYi = Math.ceil(maxY)
    let maxZi = Math.ceil(maxZ)

    if (maxXi > sizeX) maxXi = sizeX
    if (maxYi > sizeY) maxYi = sizeY
    if (maxZi > sizeZ) maxZi = sizeZ

    let smallestT = 1

    // Loop voxels
    for (let z = minZi; z < maxZi; z++) {
        const base = z * XY
        for (let y = minYi; y < maxYi; y++) {
            const i = base + y * X
            for (let x = minXi; x < maxXi; x++) {

                const idx = i + x
                if (voxels[idx] === 0) continue

                // Inline slab test
                let tEnter = 0
                let tExit = 1

                // X
                if (dx > 0) {
                    const t1 = (x - bx) / dx
                    const t2 = (x + 1 - ax) / dx
                    if (t1 > tEnter) tEnter = t1
                    if (t2 < tExit) tExit = t2
                } else if (dx < 0) {
                    const t1 = (x + 1 - ax) / dx
                    const t2 = (x - bx) / dx
                    if (t1 > tEnter) tEnter = t1
                    if (t2 < tExit) tExit = t2
                } else {
                    if (bx <= x || ax >= x + 1) continue
                }

                // Y
                if (dy > 0) {
                    const t1 = (y - by) / dy
                    const t2 = (y + 1 - ay) / dy
                    if (t1 > tEnter) tEnter = t1
                    if (t2 < tExit) tExit = t2
                } else if (dy < 0) {
                    const t1 = (y + 1 - ay) / dy
                    const t2 = (y - by) / dy
                    if (t1 > tEnter) tEnter = t1
                    if (t2 < tExit) tExit = t2
                } else {
                    if (by <= y || ay >= y + 1) continue
                }

                // Z
                if (dz > 0) {
                    const t1 = (z - bz) / dz
                    const t2 = (z + 1 - az) / dz
                    if (t1 > tEnter) tEnter = t1
                    if (t2 < tExit) tExit = t2
                } else if (dz < 0) {
                    const t1 = (z + 1 - az) / dz
                    const t2 = (z - bz) / dz
                    if (t1 > tEnter) tEnter = t1
                    if (t2 < tExit) tExit = t2
                } else {
                    if (bz <= z || az >= z + 1) continue
                }

                if (tEnter <= tExit && tEnter >= 0 && tEnter < smallestT) {
                    smallestT = tEnter
                    if (smallestT <= 0) return 0
                }
            }
        }
    }

    return smallestT
}