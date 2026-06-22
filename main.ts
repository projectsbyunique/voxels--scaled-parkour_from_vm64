const scale = 32
namespace userconfig {
    export const ARCADE_SCREEN_WIDTH = 4 * scale
    export const ARCADE_SCREEN_HEIGHT = 3 * scale
}

const screenW = userconfig.ARCADE_SCREEN_WIDTH
const screenH = userconfig.ARCADE_SCREEN_HEIGHT
let s = [5,3,1]
let scaleX = s
let scaleY = s
let scaleZ = s

varsInit()
let lastTime = game.runtime()

game.onPaint(function () {
    const now = game.runtime()
    const dt = (now - lastTime) / 1000
    stats.setStat(((10/dt|0)/10).toString())
    lastTime = now

    player.update(dt)
    
    player.computeBasis()
    const f = fVec
    const r = rVec
    const u = uVec

    const pX = getPatternedPos(player.x, scaleX)
    const pY = getPatternedPos(player.y, scaleY)
    const pZ = getPatternedPos(player.z, scaleZ)

    for (let py = 0; py < screenH; ++py) {
        for (let px = 0; px < screenW; ++px) {
            let sx = sxTable[px]
            let sy = syTable[py]

            sx *= fov
            sy *= fov

            renderX = f[0] + r[0] * sx + u[0] * sy
            renderY = f[1] + r[1] * sx + u[1] * sy
            renderZ = f[2] + r[2] * sx + u[2] * sy

            const hit = traceRay(
                pX, pY, pZ,
                renderX, renderY, renderZ,
                30
            )

            const face = hit.face | 0;
            if (face > -1) {
                const voxel = hit.voxelType | 0;

                const base = ((voxel * 6) | 0) + face;
                const w = (texW[base] | 0) + 1;

                const tx = (hit.u * w) | 0;
                const ty = (hit.v * ((texH[base] | 0) + 1)) | 0;

                screen.setPixel(px, py, texData[voxel][face][(tx + ty * w) | 0]);
            }

        }
    }
})

class PatternCache {
    arr: number[];
    sum: number;
    plen: number;
    prefix: number[];

    constructor(arr: number[], sum: number, plen: number, prefix: number[]) {
        this.arr = arr;
        this.sum = sum;
        this.plen = plen;
        this.prefix = prefix;
    }
}

const GK_patternCaches: PatternCache[] = [];

function getPatternedPos(logicalCoord: number, pattern: number[]): number {
    let cache: PatternCache = null;
    const registryLen = GK_patternCaches.length;

    for (let i = 0; i < registryLen; i++) {
        if (GK_patternCaches[i].arr === pattern) {
            cache = GK_patternCaches[i];
            break;
        }
    }

    // If it's a new pattern layout, compile it safely into the registry once
    if (!cache) {
        const len = pattern.length;
        const prefix: number[] = [];
        let accum = 0;

        for (let i = 0; i < len; i++) {
            prefix.push(accum);
            accum += pattern[i];
        }

        cache = new PatternCache(pattern, accum, len, prefix);
        GK_patternCaches.push(cache);
    }

    const plen = cache.plen | 0;
    const sum = cache.sum;
    const prefix = cache.prefix;

    const intPart = Math.floor(logicalCoord) | 0;
    const fraction = logicalCoord - intPart;

    // 3. High-speed unified cyclic indexing
    let idx = intPart % plen;
    let cycles = (intPart / plen) | 0;

    if (idx < 0) {
        idx = (idx + plen) | 0;
        cycles = (cycles - 1) | 0;
    }

    // 4. Clean offset property lookups (completely skips 'iface' dynamic calls)
    return cycles * sum + prefix[idx] + fraction * pattern[idx];
}