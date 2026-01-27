================================================================================
                    GE-Library - Granado Espada Tools - Version 0.1
================================================================================

GE-Library is an open-source, modern replacement for the original Granado Espada
development tools. This project provides high-performance, cross-platform tools for
working with IPF archive files used in Granado Espada game development.

--------------------

GE-Library recreates and enhances the functionality of the original Windows tools
used for Granado Espada development and modding. Our tools provide:

  • Cross-platform support: Linux, Windows, macOS
  • Modern hardware optimization for multi-core systems
  • Faster than original tools (10-15x when tested under Wine)
  • 100% compatibility with original file formats
  • Open development with community contributions

INCLUDED TOOLS
--------------

1. IPF Extractor (tools/ipf-extractor)
   Extract IPF archives with proper filename decryption.
   
2. IPF Optimizer (tools/ipf-optimizer)
   Optimize IPF archives by removing duplicate files.

HOW TO USE
-----------

IPF Extractor:
  tools/ipf-extractor -input <archive.ipf> -output <output_dir> [options]

  Options:
    -input      Input IPF file path (required)
    -output     Output directory (default: extracted)
    -workers    Number of worker threads (0 = auto-detect)
    -verbose    Enable detailed output
    -quiet      Suppress all output except errors
    -progress   Show progress bar (default: true)

IPF Optimizer:
  tools/ipf-optimizer -input <archive.ipf> [options]

  Options:
    -input      Input IPF file path (required)
    -backup     Create backup file (.ipf.bak)
    -verbose    Enable detailed output

Examples:
  # Extract an IPF archive
  tools/ipf-extractor -input data.ipf -output extracted_data

  # Extract with all CPU cores
  tools/ipf-extractor -input data.ipf -workers 0 -verbose

  # Optimize an IPF archive
  tools/ipf-optimizer -input data.ipf -backup

DOCUMENTATION
-------------

For detailed documentation, technical information, and additional resources,
see the documentation/ folder in the source repository.

  • documentation/DEVELOPMENT.md    - Technical development guide
  • documentation/TESTING.md        - Testing procedures
  • documentation/release_notes      - Complete release history

SUPPORT & UPDATES
-----------------

Project Home: https://github.com/joao-paulo-santos/GE-Library

For the latest updates, bug reports, and feature requests, please visit:
https://github.com/joao-paulo-santos/GE-Library/issues

LICENSING
---------

This project is provided as an open-source replacement for game development
tooling. All reverse engineering was conducted for educational and preservation
purposes. Please respect the game's terms of service and intellectual
property rights.

================================================================================
                              Version 0.1
================================================================================
