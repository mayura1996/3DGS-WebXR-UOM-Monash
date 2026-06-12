import { open, stat, writeFile } from "node:fs/promises";
import { SpzWriter } from "@sparkjsdev/spark";

const inputPath = process.argv[2] ?? "public/Candi1.ply";
const outputPath = process.argv[3] ?? "public/Candi1-optimized.spz";
const requestedCount = Number.parseInt(process.argv[4] ?? "350000", 10);
const histogramBins = 65536;
const sampleLimit = 200000;
const SH_C0 = 0.28209479177387814;

if (!Number.isInteger(requestedCount) || requestedCount <= 0) {
    throw new Error("Target splat count must be a positive integer.");
}

const typeSizes = {
    char: 1, int8: 1, uchar: 1, uint8: 1,
    short: 2, int16: 2, ushort: 2, uint16: 2,
    int: 4, int32: 4, uint: 4, uint32: 4,
    float: 4, float32: 4, double: 8, float64: 8
};

async function readMetadata(path) {
    const handle = await open(path, "r");
    try {
        const headerBuffer = Buffer.alloc(65536);
        const { bytesRead } = await handle.read(headerBuffer, 0, headerBuffer.length, 0);
        const headerText = headerBuffer.subarray(0, bytesRead).toString("ascii");
        const marker = "end_header";
        const markerIndex = headerText.indexOf(marker);
        if (markerIndex < 0) throw new Error("PLY header is larger than 64 KB or malformed.");

        let dataOffset = markerIndex + marker.length;
        while (headerText[dataOffset] === "\r" || headerText[dataOffset] === "\n") dataOffset++;

        const lines = headerText.slice(0, markerIndex).split(/\r?\n/);
        let vertexCount = 0;
        let readingVertex = false;
        let recordSize = 0;
        const properties = {};

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts[0] === "format" && parts[1] !== "binary_little_endian") {
                throw new Error("Only binary little-endian PLY files are supported.");
            }
            if (parts[0] === "element") {
                readingVertex = parts[1] === "vertex";
                if (readingVertex) vertexCount = Number.parseInt(parts[2], 10);
                continue;
            }
            if (readingVertex && parts[0] === "property") {
                if (parts[1] === "list") throw new Error("List properties are not supported in vertex records.");
                const size = typeSizes[parts[1]];
                if (!size) throw new Error(`Unsupported PLY property type: ${parts[1]}`);
                properties[parts[2]] = { offset: recordSize, type: parts[1] };
                recordSize += size;
            }
        }

        for (const name of ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity",
            "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]) {
            if (!properties[name]) throw new Error(`Missing required PLY property: ${name}`);
            if (!["float", "float32"].includes(properties[name].type)) {
                throw new Error(`Property ${name} must be a 32-bit float.`);
            }
        }

        return { vertexCount, recordSize, dataOffset, properties };
    } finally {
        await handle.close();
    }
}

async function processRecords(path, metadata, callback) {
    const handle = await open(path, "r");
    const recordsPerChunk = 32768;
    const buffer = Buffer.allocUnsafe(metadata.recordSize * recordsPerChunk);
    let index = 0;

    try {
        while (index < metadata.vertexCount) {
            const count = Math.min(recordsPerChunk, metadata.vertexCount - index);
            const bytesToRead = count * metadata.recordSize;
            const position = metadata.dataOffset + index * metadata.recordSize;
            const { bytesRead } = await handle.read(buffer, 0, bytesToRead, position);
            if (bytesRead !== bytesToRead) {
                throw new Error(`Unexpected end of PLY data at vertex ${index}.`);
            }

            const view = new DataView(buffer.buffer, buffer.byteOffset, bytesRead);
            for (let localIndex = 0; localIndex < count; localIndex++) {
                callback(index + localIndex, view, localIndex * metadata.recordSize);
            }
            index += count;
        }
    } finally {
        await handle.close();
    }
}

function readFloat(view, base, property) {
    return view.getFloat32(base + property.offset, true);
}

function percentile(values, fraction) {
    values.sort((a, b) => a - b);
    return values[Math.floor((values.length - 1) * fraction)];
}

console.log(`Reading ${inputPath}...`);
const metadata = await readMetadata(inputPath);
const inputStats = await stat(inputPath);
const sampleStride = Math.max(1, Math.floor(metadata.vertexCount / sampleLimit));
const sampleX = [];
const sampleY = [];
const sampleZ = [];
const p = metadata.properties;

console.log(`Sampling bounds from ${metadata.vertexCount.toLocaleString()} splats...`);
await processRecords(inputPath, metadata, (index, view, base) => {
    if (index % sampleStride !== 0) return;
    sampleX.push(readFloat(view, base, p.x));
    sampleY.push(readFloat(view, base, p.y));
    sampleZ.push(readFloat(view, base, p.z));
});

const bounds = {
    minX: percentile(sampleX, 0.005),
    maxX: percentile(sampleX, 0.995),
    minY: percentile(sampleY, 0.005),
    maxY: percentile(sampleY, 0.995),
    minZ: percentile(sampleZ, 0.005),
    maxZ: percentile(sampleZ, 0.995)
};

function isInlier(x, y, z) {
    return x >= bounds.minX && x <= bounds.maxX &&
        y >= bounds.minY && y <= bounds.maxY &&
        z >= bounds.minZ && z <= bounds.maxZ;
}

function sigmoid(value) {
    return 1 / (1 + Math.exp(-value));
}

const histogram = new Uint32Array(histogramBins);
let eligibleCount = 0;

console.log("Building opacity histogram for inlier splats...");
await processRecords(inputPath, metadata, (index, view, base) => {
    const x = readFloat(view, base, p.x);
    const y = readFloat(view, base, p.y);
    const z = readFloat(view, base, p.z);
    if (!isInlier(x, y, z)) return;

    const opacity = sigmoid(readFloat(view, base, p.opacity));
    const bin = Math.min(histogramBins - 1, Math.max(0, Math.floor(opacity * (histogramBins - 1))));
    histogram[bin]++;
    eligibleCount++;
});

const targetCount = Math.min(requestedCount, eligibleCount);
let thresholdBin = histogramBins - 1;
let countAboveThreshold = 0;

for (; thresholdBin >= 0; thresholdBin--) {
    const nextCount = countAboveThreshold + histogram[thresholdBin];
    if (nextCount >= targetCount) break;
    countAboveThreshold = nextCount;
}

let thresholdSlots = targetCount - countAboveThreshold;
const writer = new SpzWriter({
    numSplats: targetCount,
    shDegree: 0,
    fractionalBits: 12,
    flagAntiAlias: true
});
let outputIndex = 0;

console.log(`Encoding ${targetCount.toLocaleString()} high-opacity inlier splats...`);
await processRecords(inputPath, metadata, (index, view, base) => {
    if (outputIndex >= targetCount) return;

    const x = readFloat(view, base, p.x);
    const y = readFloat(view, base, p.y);
    const z = readFloat(view, base, p.z);
    if (!isInlier(x, y, z)) return;

    const opacity = sigmoid(readFloat(view, base, p.opacity));
    const bin = Math.min(histogramBins - 1, Math.max(0, Math.floor(opacity * (histogramBins - 1))));
    if (bin < thresholdBin) return;
    if (bin === thresholdBin) {
        if (thresholdSlots <= 0) return;
        thresholdSlots--;
    }

    writer.setCenter(outputIndex, x, y, z);
    writer.setScale(
        outputIndex,
        Math.exp(readFloat(view, base, p.scale_0)),
        Math.exp(readFloat(view, base, p.scale_1)),
        Math.exp(readFloat(view, base, p.scale_2))
    );
    writer.setQuat(
        outputIndex,
        readFloat(view, base, p.rot_1),
        readFloat(view, base, p.rot_2),
        readFloat(view, base, p.rot_3),
        readFloat(view, base, p.rot_0)
    );
    writer.setAlpha(outputIndex, opacity);
    writer.setRgb(
        outputIndex,
        readFloat(view, base, p.f_dc_0) * SH_C0 + 0.5,
        readFloat(view, base, p.f_dc_1) * SH_C0 + 0.5,
        readFloat(view, base, p.f_dc_2) * SH_C0 + 0.5
    );
    outputIndex++;
});

if (outputIndex !== targetCount) {
    throw new Error(`Expected ${targetCount} splats but encoded ${outputIndex}.`);
}

const optimizedBytes = await writer.finalize();
await writeFile(outputPath, optimizedBytes);

console.log(`Wrote ${outputPath}`);
console.log(`Splats: ${metadata.vertexCount.toLocaleString()} -> ${targetCount.toLocaleString()}`);
console.log("Clip bounds:", bounds);
console.log(`Size: ${(inputStats.size / 1024 / 1024).toFixed(1)} MB -> ${(optimizedBytes.byteLength / 1024 / 1024).toFixed(1)} MB`);
