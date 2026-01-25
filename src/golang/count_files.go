package main

import (
	"archive/zip"
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: count_files <ipf_file>")
		os.Exit(1)
	}

	reader, err := zip.OpenReader(os.Args[1])
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	defer reader.Close()

	fmt.Printf("%d\n", len(reader.File))
}
