package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/joao-paulo-santos/GE-Library/pkg/creator"
)

func main() {
	folder := flag.String("folder", "", "Input folder to create IPF from (required)")
	output := flag.String("output", "", "Output IPF file path (required)")
	encrypt := flag.Bool("encrypt", true, "Encrypt filenames (true=IPF, false=ZIP)")
	compression := flag.Int("compression", 6, "Compression level (0-9, default 6)")
	verbose := flag.Bool("verbose", false, "Enable verbose output")

	flag.Parse()

	if *folder == "" || *output == "" {
		fmt.Println("IPF Creator v1.0.0")
		fmt.Println("Create IPF or ZIP archives from folders")
		fmt.Println()
		fmt.Println("Usage:")
		fmt.Println("  ipf-creator -folder <folder> -output <output.ipf> [options]")
		fmt.Println()
		fmt.Println("Required:")
		fmt.Println("  -folder string   Input folder to create IPF from")
		fmt.Println("  -output string   Output IPF/ZIP file path")
		fmt.Println()
		fmt.Println("Options:")
		fmt.Println("  -encrypt        Encrypt filenames (default true, false=plain ZIP)")
		fmt.Println("  -compression int Compression level 0-9 (default 6)")
		fmt.Println("  -verbose         Enable verbose output")
		fmt.Println()
		os.Exit(1)
	}

	if *verbose {
		fmt.Println("IPF Creator v1.0.0")
		fmt.Printf("Input folder: %s\n", *folder)
		fmt.Printf("Output file: %s\n", *output)
		fmt.Printf("Encrypt filenames: %v\n", *encrypt)
		fmt.Printf("Compression level: %d\n", *compression)
	}

	if *compression < 0 || *compression > 9 {
		fmt.Println("Error: Compression level must be between 0 and 9")
		os.Exit(1)
	}

	creator := creator.NewCreator(*folder, *output, *encrypt)
	creator.CompressionLevel = *compression

	if *verbose {
		fmt.Println()
		fmt.Println("Creating IPF archive...")
	}

	err := creator.CreateIPF()
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("IPF archive created successfully!")
}
