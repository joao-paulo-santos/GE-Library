#!/usr/bin/env node
/**
 * Generate PATCHNOTES.txt from documentation/release_notes/release_notes.json
 * Shows only the last 5 releases to keep file size manageable
 *
 * Options:
 *   --version X.Y.Z  Generate notes for specific version (markdown format)
 *   --latest         Generate notes for latest version (markdown format)
 *   --output PATH     Specify output file path
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let specificVersion = null;
let useLatest = false;
let outputPath = path.join(__dirname, '../PATCHNOTES.txt');

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version' && i + 1 < args.length) {
        specificVersion = args[i + 1];
        i++;
    } else if (args[i] === '--latest') {
        useLatest = true;
    } else if (args[i] === '--output' && i + 1 < args.length) {
        outputPath = args[i + 1];
        i++;
    }
}

// Configuration
const NOTES_JSON_PATH = path.join(__dirname, '../documentation/release_notes/release_notes.json');
const MAX_RELEASES = 5;

function main() {
    // Read release notes JSON
    if (!fs.existsSync(NOTES_JSON_PATH)) {
        console.error(`Error: ${NOTES_JSON_PATH} not found`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(NOTES_JSON_PATH, 'utf8'));
    const releases = data.releases || [];

    if (releases.length === 0) {
        console.error('Error: No releases found in release_notes.json');
        process.exit(1);
    }

    const githubUrl = data.github_url || 'https://github.com/joao-paulo-santos/GE-Library';

    // Determine which release to use
    let targetRelease;

    if (specificVersion) {
        // Find specific version
        targetRelease = releases.find(r => r.version === specificVersion);
        if (!targetRelease) {
            console.error(`Error: Version ${specificVersion} not found in release notes`);
            process.exit(1);
        }
    } else if (useLatest) {
        // Use latest release
        targetRelease = releases[releases.length - 1];
    } else {
        // Generate multi-release PATCHNOTES.txt (default behavior)
        generatePatchnotes(releases, githubUrl);
        return;
    }

    // Generate markdown for single version
    const markdown = generateMarkdownRelease(targetRelease);
    fs.writeFileSync(outputPath, markdown, 'utf8');

    console.log(`Generated ${outputPath}`);
    console.log(`Version: ${targetRelease.version}`);
    console.log(`Type: ${targetRelease.type}`);
    console.log(`Date: ${targetRelease.date}`);
}

function generateMarkdownRelease(release) {
    const lines = [];

    lines.push(`## Version ${release.version} - ${release.date}`);
    lines.push('');
    lines.push(`**Type:** ${release.type}`);
    lines.push('');

    if (release.changes && release.changes.length > 0) {
        lines.push('### Changes');
        release.changes.forEach(change => {
            lines.push(`- ${change}`);
        });
        lines.push('');
    }

    if (release.performance) {
        lines.push('### Performance');
        lines.push(release.performance);
        lines.push('');
    }

    if (release.known_issues && release.known_issues.length > 0) {
        lines.push('### Known Issues');
        release.known_issues.forEach(issue => {
            lines.push(`- ${issue}`);
        });
        lines.push('');
    }

    return lines.join('\n');
}

function generatePatchnotes(releases, githubUrl) {
    // Get last MAX_RELEASES releases
    const recentReleases = releases.slice(-MAX_RELEASES).reverse();

    // Generate content
    const lines = [];

    lines.push('============================================================');
    lines.push('GE-Library Release Notes');
    lines.push('============================================================');
    lines.push('');

    recentReleases.forEach(release => {
        lines.push(`Version ${release.version} - ${release.date}`);
        lines.push(`Type: ${release.type}`);
        lines.push('');

        if (release.changes && release.changes.length > 0) {
            lines.push('Changes:');
            release.changes.forEach(change => {
                lines.push(`  • ${change}`);
            });
            lines.push('');
        }

        if (release.performance) {
            lines.push(`Performance: ${release.performance}`);
            lines.push('');
        }

        if (release.known_issues && release.known_issues.length > 0) {
            lines.push('Known Issues:');
            release.known_issues.forEach(issue => {
                lines.push(`  • ${issue}`);
            });
            lines.push('');
        }

        lines.push('----------------------------------------');
        lines.push('');
    });

    // Add footer with GitHub link
    if (releases.length > MAX_RELEASES) {
        lines.push(`Older release notes available at: ${githubUrl}/releases`);
        lines.push('');
    }

    lines.push('For complete release history, visit:');
    lines.push(`${githubUrl}/releases`);
    lines.push('');

    // Write to file
    const content = lines.join('\n');
    fs.writeFileSync(outputPath, content, 'utf8');

    console.log(`Generated ${outputPath}`);
    console.log(`Showing last: ${recentReleases.length} release(s)`);
    console.log(`Total releases: ${releases.length}`);
}

main();
