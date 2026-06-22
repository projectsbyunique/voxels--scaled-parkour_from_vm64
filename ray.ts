class RayResult {
    face: number 
    t: number
    u: number
    v: number
    voxelType: number
    x: number
    y: number
    z: number
    constructor() {
        this.face = -1
        this.t = 0
        this.u = 0
        this.v = 0
        this.voxelType = 0
        this.x = 0
        this.y = 0
        this.z = 0
    }
}

const TRACE_RAY_RETURN = new RayResult();

// Global scalar caches for intersection to avoid allocating/returning an array
let interTMin = Fx.zeroFx8;
let interTMax = Fx.zeroFx8;
let interFace = -1;

// Cache bounds natively as Fx8 values to bypass conversions inside loops
let boundXFx = Fx.zeroFx8;
let boundYFx = Fx.zeroFx8;
let boundZFx = Fx.zeroFx8;

let voxelStartXArrayFx: Fx8[] = [];
let voxelEndXArrayFx: Fx8[] = [];
let voxelStartYArrayFx: Fx8[] = [];
let voxelEndYArrayFx: Fx8[] = [];
let voxelStartZArrayFx: Fx8[] = [];
let voxelEndZArrayFx: Fx8[] = [];

let voxelSizeXArrayFx: Fx8[] = [];
let voxelSizeYArrayFx: Fx8[] = [];
let voxelSizeZArrayFx: Fx8[] = [];

function precomputeWorldAxes(patternX: number[], patternY: number[], patternZ: number[]) {
    voxelStartXArrayFx = []; voxelEndXArrayFx = []; voxelSizeXArrayFx = [];
    voxelStartYArrayFx = []; voxelEndYArrayFx = []; voxelSizeYArrayFx = [];
    voxelStartZArrayFx = []; voxelEndZArrayFx = []; voxelSizeZArrayFx = [];

    buildAxisFx(patternX, sizeX, voxelSizeXArrayFx, voxelStartXArrayFx, voxelEndXArrayFx);
    buildAxisFx(patternY, sizeY, voxelSizeYArrayFx, voxelStartYArrayFx, voxelEndYArrayFx);
    buildAxisFx(patternZ, sizeZ, voxelSizeZArrayFx, voxelStartZArrayFx, voxelEndZArrayFx);

    // Cache world boundaries directly as fixed-point values
    boundXFx = voxelEndXArrayFx[(sizeX - 1) | 0];
    boundYFx = voxelEndYArrayFx[(sizeY - 1) | 0];
    boundZFx = voxelEndZArrayFx[(sizeZ - 1) | 0];
}

function buildAxisFx(pattern: number[], count: number, size: Fx8[], start: Fx8[], end: Fx8[]) {
    let p = Fx.zeroFx8;
    let plen = pattern.length | 0;

    for (let i = 0; i < count; i++) {
        let s = Fx8(pattern[i % plen]);
        size[i] = s;
        start[i] = p;
        p = Fx.add(p, s);
        end[i] = p;
    }
}

function rayBoxIntersectionFx(
    ox: Fx8, oy: Fx8, oz: Fx8,
    dx: Fx8, dy: Fx8, dz: Fx8
): boolean {
    let tmin = Fx8(-9999);
    let tmax = Fx8(9999);

    // Cast out constants to raw numbers for direct register-speed comparisons
    const zeroRaw = (Fx.zeroFx8 as any as number) | 0;
    const boundXRaw = (boundXFx as any as number) | 0;
    const boundYRaw = (boundYFx as any as number) | 0;
    const boundZRaw = (boundZFx as any as number) | 0;

    const oxRaw = (ox as any as number) | 0;
    const oyRaw = (oy as any as number) | 0;
    const ozRaw = (oz as any as number) | 0;

    const dxRaw = (dx as any as number) | 0;
    const dyRaw = (dy as any as number) | 0;
    const dzRaw = (dz as any as number) | 0;

    // --- X SLAB ---
    if (dx !== Fx.zeroFx8) {
        let tx1 = Fx.div(Fx.neg(ox), dx);
        let tx2 = Fx.div(Fx.sub(boundXFx, ox), dx);

        if ((tx1 as any as number) > (tx2 as any as number)) { const t = tx1; tx1 = tx2; tx2 = t; }
        if ((tx1 as any as number) > (tmin as any as number)) {
            tmin = tx1;
            interFace = dxRaw > zeroRaw ? 0 : 1;
        }
        if ((tx2 as any as number) < (tmax as any as number)) tmax = tx2;
    } else if (oxRaw <= zeroRaw || oxRaw >= boundXRaw) {
        return false;
    }

    // --- Y SLAB ---
    if (dy !== Fx.zeroFx8) {
        let ty1 = Fx.div(Fx.neg(oy), dy);
        let ty2 = Fx.div(Fx.sub(boundYFx, oy), dy);

        if ((ty1 as any as number) > (ty2 as any as number)) { const t = ty1; ty1 = ty2; ty2 = t; }
        if ((ty1 as any as number) > (tmin as any as number)) {
            tmin = ty1;
            interFace = dyRaw > zeroRaw ? 2 : 3;
        }
        if ((ty2 as any as number) < (tmax as any as number)) tmax = ty2;
    } else if (oyRaw <= zeroRaw || oyRaw >= boundYRaw) {
        return false;
    }

    // --- Z SLAB ---
    if (dz !== Fx.zeroFx8) {
        let tz1 = Fx.div(Fx.neg(oz), dz);
        let tz2 = Fx.div(Fx.sub(boundZFx, oz), dz);

        if ((tz1 as any as number) > (tz2 as any as number)) { const t = tz1; tz1 = tz2; tz2 = t; }
        if ((tz1 as any as number) > (tmin as any as number)) {
            tmin = tz1;
            interFace = dzRaw > zeroRaw ? 4 : 5;
        }
        if ((tz2 as any as number) < (tmax as any as number)) tmax = tz2;
    } else if (ozRaw <= zeroRaw || ozRaw >= boundZRaw) {
        return false;
    }

    // Final checks using raw number unboxed values
    const tminRaw = (tmin as any as number) | 0;
    const tmaxRaw = (tmax as any as number) | 0;

    if (tmaxRaw < tminRaw || tmaxRaw < zeroRaw) return false;

    interTMin = tmin;
    interTMax = tmax;
    return true;
}

function traceRay(
    origX: number, origY: number, origZ: number,
    dirX: number, dirY: number, dirZ: number,
    maxSteps: number
): RayResult {
    const ox = Fx8(origX); const oy = Fx8(origY); const oz = Fx8(origZ);
    const dx = Fx8(dirX); const dy = Fx8(dirY); const dz = Fx8(dirZ);

    if (!rayBoxIntersectionFx(ox, oy, oz, dx, dy, dz)) {
        TRACE_RAY_RETURN.face = -1;
        return TRACE_RAY_RETURN;
    }

    let startT = interTMin;
    if ((startT as any as number) < 0) startT = Fx.zeroFx8;
    const limitT = interTMax;

    let rx = Fx.add(ox, Fx.mul(dx, startT));
    let ry = Fx.add(oy, Fx.mul(dy, startT));
    let rz = Fx.add(oz, Fx.mul(dz, startT));

    const EPS = 1 as any as Fx8;
    if (dirX > 0) rx = Fx.add(rx, EPS); else if (dirX < 0) rx = Fx.sub(rx, EPS);
    if (dirY > 0) ry = Fx.add(ry, EPS); else if (dirY < 0) ry = Fx.sub(ry, EPS);
    if (dirZ > 0) rz = Fx.add(rz, EPS); else if (dirZ < 0) rz = Fx.sub(rz, EPS);

    if ((rx as any as number) < 0) rx = Fx.zeroFx8;
    if ((rx as any as number) >= (boundXFx as any as number)) rx = Fx.sub(boundXFx, EPS);
    if ((ry as any as number) < 0) ry = Fx.zeroFx8;
    if ((ry as any as number) >= (boundYFx as any as number)) ry = Fx.sub(boundYFx, EPS);
    if ((rz as any as number) < 0) rz = Fx.zeroFx8;
    if ((rz as any as number) >= (boundZFx as any as number)) rz = Fx.sub(boundZFx, EPS);

    const sX = sizeX | 0; const sY = sizeY | 0; const sZ = sizeZ | 0;
    let x = 0; let y = 0; let z = 0;

    // --- Binary Searches ---
    if ((rx as any as number) > (voxelStartXArrayFx[0] as any as number)) {
        let last = (sX - 1) | 0;
        if ((rx as any as number) >= (voxelEndXArrayFx[last] as any as number)) { x = last; }
        else {
            let lo = 0, hi = last;
            while (lo <= hi) {
                let mid = (lo + hi) >> 1;
                if ((rx as any as number) < (voxelStartXArrayFx[mid] as any as number)) hi = (mid - 1) | 0;
                else if ((rx as any as number) >= (voxelEndXArrayFx[mid] as any as number)) lo = (mid + 1) | 0;
                else { x = mid; break; }
            }
        }
    }
    if ((ry as any as number) > (voxelStartYArrayFx[0] as any as number)) {
        let last = (sY - 1) | 0;
        if ((ry as any as number) >= (voxelEndYArrayFx[last] as any as number)) { y = last; }
        else {
            let lo = 0, hi = last;
            while (lo <= hi) {
                let mid = (lo + hi) >> 1;
                if ((ry as any as number) < (voxelStartYArrayFx[mid] as any as number)) hi = (mid - 1) | 0;
                else if ((ry as any as number) >= (voxelEndYArrayFx[mid] as any as number)) lo = (mid + 1) | 0;
                else { y = mid; break; }
            }
        }
    }
    if ((rz as any as number) > (voxelStartZArrayFx[0] as any as number)) {
        let last = (sZ - 1) | 0;
        if ((rz as any as number) >= (voxelEndZArrayFx[last] as any as number)) { z = last; }
        else {
            let lo = 0, hi = last;
            while (lo <= hi) {
                let mid = (lo + hi) >> 1;
                if ((rz as any as number) < (voxelStartZArrayFx[mid] as any as number)) hi = (mid - 1) | 0;
                else if ((rz as any as number) >= (voxelEndZArrayFx[mid] as any as number)) lo = (mid + 1) | 0;
                else { z = mid; break; }
            }
        }
    }

    const stepX = dirX > 0 ? 1 : -1;
    const stepY = dirY > 0 ? 1 : -1;
    const stepZ = dirZ > 0 ? 1 : -1;

    const invDx = dx !== Fx.zeroFx8 ? Fx.div(Fx.oneFx8, dx) : (0 as any as Fx8);
    const invDy = dy !== Fx.zeroFx8 ? Fx.div(Fx.oneFx8, dy) : (0 as any as Fx8);
    const invDz = dz !== Fx.zeroFx8 ? Fx.div(Fx.oneFx8, dz) : (0 as any as Fx8);

    const fxInfinity = Fx8(9999);

    let tMaxX = dx !== Fx.zeroFx8 ? Fx.mul(Fx.sub((dirX > 0 ? voxelEndXArrayFx[x] : voxelStartXArrayFx[x]), ox), invDx) : fxInfinity;
    let tMaxY = dy !== Fx.zeroFx8 ? Fx.mul(Fx.sub((dirY > 0 ? voxelEndYArrayFx[y] : voxelStartYArrayFx[y]), oy), invDy) : fxInfinity;
    let tMaxZ = dz !== Fx.zeroFx8 ? Fx.mul(Fx.sub((dirZ > 0 ? voxelEndZArrayFx[z] : voxelStartZArrayFx[z]), oz), invDz) : fxInfinity;

    let face = -1;
    let steps = 0;

    const localXStride = X | 0;
    const localXYStride = XY | 0;

    // ==========================================
    // UNBOX HOT PATH VARIABLES INTO RAW INTEGERS
    // ==========================================
    let tMaxXRaw = (tMaxX as any as number) | 0;
    let tMaxYRaw = (tMaxY as any as number) | 0;
    let tMaxZRaw = (tMaxZ as any as number) | 0;
    let tCurrentRaw = (startT as any as number) | 0;
    const limitTRaw = (limitT as any as number) | 0;

    const oxRaw = (ox as any as number) | 0;
    const oyRaw = (oy as any as number) | 0;
    const ozRaw = (oz as any as number) | 0;

    const invDxRaw = (invDx as any as number) | 0;
    const invDyRaw = (invDy as any as number) | 0;
    const invDzRaw = (invDz as any as number) | 0;

    const dxRaw = (dx as any as number) | 0;
    const dyRaw = (dy as any as number) | 0;
    const dzRaw = (dz as any as number) | 0;
    const fxInfinityRaw = (fxInfinity as any as number) | 0;

    // 100% Native Integer Operations Loop
    while (steps < maxSteps && tCurrentRaw <= limitTRaw) {
        if (x < 0 || x >= sX || y < 0 || y >= sY || z < 0 || z >= sZ) break;

        const idx = (x + y * localXStride + z * localXYStride) | 0;
        const voxelType = voxels[idx];

        if (voxelType !== 0) {
            if (face === -1) face = interFace

            const tCurrentFx = tCurrentRaw as any as Fx8;
            const hx = Fx.add(ox, Fx.mul(dx, tCurrentFx));
            const hy = Fx.add(oy, Fx.mul(dy, tCurrentFx));
            const hz = Fx.add(oz, Fx.mul(dz, tCurrentFx));

            let uFx = Fx.zeroFx8; let vFx = Fx.zeroFx8;

            if (face === 0 || face === 1) {
                uFx = Fx.div(Fx.sub(hz, voxelStartZArrayFx[z]), voxelSizeZArrayFx[z]);
                vFx = Fx.div(Fx.sub(hy, voxelStartYArrayFx[y]), voxelSizeYArrayFx[y]);
            } else if (face === 2 || face === 3) {
                uFx = Fx.div(Fx.sub(hx, voxelStartXArrayFx[x]), voxelSizeXArrayFx[x]);
                vFx = Fx.div(Fx.sub(hz, voxelStartZArrayFx[z]), voxelSizeZArrayFx[z]);
            } else {
                uFx = Fx.div(Fx.sub(hx, voxelStartXArrayFx[x]), voxelSizeXArrayFx[x]);
                vFx = Fx.div(Fx.sub(hy, voxelStartYArrayFx[y]), voxelSizeYArrayFx[y]);
            }

            let uRaw = uFx as any as number;
            if (uRaw < 0) uRaw = 0;
            else if (uRaw > 255) uRaw = 0.99609375;
            else uRaw /= 256;

            let vRaw = vFx as any as number;
            if (vRaw < 0) vRaw = 0;
            else if (vRaw > 255) vRaw = 0.99609375;
            else vRaw /= 256;

            TRACE_RAY_RETURN.face = face;
            TRACE_RAY_RETURN.t = Fx.toFloat(tCurrentFx);
            TRACE_RAY_RETURN.u = uRaw;
            TRACE_RAY_RETURN.v = vRaw;
            TRACE_RAY_RETURN.voxelType = voxelType;
            TRACE_RAY_RETURN.x = x;
            TRACE_RAY_RETURN.y = y;
            TRACE_RAY_RETURN.z = z;
            return TRACE_RAY_RETURN;
        }

        // Optimized DDA Branch Calculations using pure Javascript Math primitives
        if (tMaxXRaw < tMaxYRaw && tMaxXRaw < tMaxZRaw) {
            face = stepX < 0 ? 0 : 1;
            tCurrentRaw = tMaxXRaw;
            x = (x + stepX) | 0;
            if (dxRaw !== 0) {
                const bound = (stepX > 0 ? voxelEndXArrayFx[x] : voxelStartXArrayFx[x]) as any as number;
                tMaxXRaw = Math.imul(bound - oxRaw, invDxRaw) >> 8;
            } else {
                tMaxXRaw = fxInfinityRaw;
            }
        } else if (tMaxYRaw < tMaxZRaw) {
            face = stepY < 0 ? 2 : 3;
            tCurrentRaw = tMaxYRaw;
            y = (y + stepY) | 0;
            if (dyRaw !== 0) {
                const bound = (stepY > 0 ? voxelEndYArrayFx[y] : voxelStartYArrayFx[y]) as any as number;
                tMaxYRaw = Math.imul(bound - oyRaw, invDyRaw) >> 8;
            } else {
                tMaxYRaw = fxInfinityRaw;
            }
        } else {
            face = stepZ < 0 ? 4 : 5;
            tCurrentRaw = tMaxZRaw;
            z = (z + stepZ) | 0;
            if (dzRaw !== 0) {
                const bound = (stepZ > 0 ? voxelEndZArrayFx[z] : voxelStartZArrayFx[z]) as any as number;
                tMaxZRaw = Math.imul(bound - ozRaw, invDzRaw) >> 8;
            } else {
                tMaxZRaw = fxInfinityRaw;
            }
        }

        steps = (steps + 1) | 0;
    }

    TRACE_RAY_RETURN.face = -1;
    return TRACE_RAY_RETURN;
}