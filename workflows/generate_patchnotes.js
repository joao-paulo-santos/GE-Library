#!/usr/bin/env node
/**
 * Generate PATCHNOTES.txt from documentation/release_notes/release_notes.json
 * Shows only the last 5 releases to keep file size manageable
 */

const fs = require('fs');
const path = require('path');

// Configuration
const NOTES_JSON_PATH = path.join(__dirname, '../documentation/release_notes/release_notes.json');
const OUTPUT_PATH = path.join(__dirname, '../PATCHNOTES.txt');
const MAX_RELEASES = 5;

function main() {
    // Read release notes JSON
    if (!fs.existsSync(NOTES_JSON_PATH)) {
        console.error(`Error: ${NOTES_JSON_PATH} not found`);
        process.exit(1);
    }
    
    const data = JSON.parse(fs.readFileSync(NOTES_JSON_PATH, 'utf8'));
    const releases = data.releases || [];
    const githubUrl = data.github_url || 'https://github.com/joao-paulo-santos/GE-Library';
    
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
    fs.writeFileSync(OUTPUT_PATH, content, 'utf8');
    
    console.log(`Generated ${OUTPUT_PATH}`);
    console.log(`Showing last: ${recentReleases.length} release(s)`);
    console.log(`Total releases: ${releases.length}`);
}

main();
