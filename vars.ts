let renderX = 0
let renderY = 0
let renderZ = 0
const fVec = [0, 0, 0]
const rVec = [0, 0, 0]
const uVec = [0, 0, 0]
let sxTable: number[] = []
let syTable: number[] = []

const X = sizeX
const XY = X * sizeY
const XYZ = XY * sizeZ

let voxels: number[] = []
let texData: number[][][] = []
const texW: number[] = []
const texH: number[] = []
const texDisp: number[] = []



function varsInit() {
    precomputeWorldAxes(scaleX,scaleY,scaleZ)
    for (let i = 0; i < chars.length; ++i) {
        charToIndex[chars.charCodeAt(i)] = i
    }

    for (let t = 0; t < textures.length; ++t) {
        texData[t] = []
        for (let f = 5; f >= 0; --f) {
            const row = textures[t][f]
            texData[t][5 - f] = []   // keep output in normal order
            const len = row.length - 2
            for (let i = 0; i < len; i++) {
                texData[t][5 - f][i] = hexToNum(row[row.length - 1 - i])
            }
        }
    }

    for (let v = 0; v < textures.length; ++v) {
        for (let f = 0; f < 6; ++f) {
            const row = textures[v][f]
            const w = charToIndex[row.charCodeAt(0)]
            const h = charToIndex[row.charCodeAt(1)]
            texW.push(w)
            texH.push(h)
        }
        const row = textures[v][6]
        const char = row.charCodeAt(0)
        const disp = charToIndex[char]
        texDisp.push(disp)
    }
        

    
    for (let z = 0; z < sizeZ; ++z)
        for (let y = 0; y < sizeY; ++y)
            for (let x = 0; x < sizeX; ++x)
                voxels[x + y * sizeX + z * XY] = charToIndex[slices[z][y].charCodeAt(x)]

    for (let x = 0; x < screenW; x++) {
        sxTable[x] = (x / screenW) * 2 - 1
    }
    for (let y = 0; y < screenH; y++) {
        syTable[screenH - y - 1] = (y / screenH) * 2 - 1
    }
}