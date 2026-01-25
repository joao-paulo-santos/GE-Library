const fs = require('fs');

function countIPFFiles(filePath) {
    const buffer = fs.readFileSync(filePath);
    const size = buffer.length;

    let pos = size - 22;
    if (pos < 0) {
        return 0;
    }

    while (pos >= 0) {
        const signature = buffer.readUInt32LE(pos);
        if (signature === 0x06054b50) {
            const centralDirCount = buffer.readUInt16LE(pos + 8);
            return centralDirCount;
        }
        pos--;
    }

    return 0;
}

if (require.main === module) {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Usage: node count-ipf-files.js <ipf_file>');
        process.exit(1);
    }

    try {
        const count = countIPFFiles(filePath);
        console.log(count);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

module.exports = { countIPFFiles };
