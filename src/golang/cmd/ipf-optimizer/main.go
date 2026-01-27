package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/joao-paulo-santos/GE-Library/pkg/optimize"
)

func main() {
	createBackup := flag.Bool("backup", false, "Create backup file (.ipf.bak)")
	flag.Parse()

	if len(flag.Args()) < 1 {
		fmt.Println("Usage: ipf-optimizer [--backup] <input.ipf>")
		os.Exit(1)
	}

	inputFile := flag.Args()[0]

	if _, err := os.Stat(inputFile); os.IsNotExist(err) {
		fmt.Printf("Error: File not found: %s\n", inputFile)
		os.Exit(1)
	}

	if err := optimize.OptimizeIPF(inputFile, *createBackup); err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Optimization complete!")
}
