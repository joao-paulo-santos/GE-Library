package workers

import (
	"context"
	"runtime"
	"sync"
)

// Task represents a unit of work to be processed
type Task[T any] interface {
	Execute() T
}

// FunctionTask wraps a function to implement Task interface
type FunctionTask[T any] struct {
	fn func() T
}

func (ft *FunctionTask[T]) Execute() T {
	return ft.fn()
}

// NewFunctionTask creates a task from a function
func NewFunctionTask[T any](fn func() T) *FunctionTask[T] {
	return &FunctionTask[T]{fn: fn}
}

// WorkerPool manages a pool of goroutines for concurrent task execution
type WorkerPool[T any] struct {
	workerCount int
	taskQueue   chan Task[T]
	wg          sync.WaitGroup
}

// NewWorkerPool creates a new worker pool with the specified number of workers
func NewWorkerPool[T any](workerCount int) *WorkerPool[T] {
	if workerCount <= 0 {
		workerCount = runtime.NumCPU()
	}

	return &WorkerPool[T]{
		workerCount: workerCount,
		taskQueue:   make(chan Task[T], workerCount*2), // Buffer for efficiency
	}
}

// NewMaxWorkerPool creates a worker pool using all available CPU cores
func NewMaxWorkerPool[T any]() *WorkerPool[T] {
	return NewWorkerPool[T](runtime.NumCPU())
}

// Start starts the worker pool goroutines
func (wp *WorkerPool[T]) Start(ctx context.Context) {
	for i := 0; i < wp.workerCount; i++ {
		wp.wg.Add(1)
		go wp.worker(ctx)
	}
}

// worker is the individual worker goroutine
func (wp *WorkerPool[T]) worker(ctx context.Context) {
	defer wp.wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case task, ok := <-wp.taskQueue:
			if !ok {
				return // Channel closed
			}
			task.Execute()
		}
	}
}

// Submit submits a task to the worker pool
func (wp *WorkerPool[T]) Submit(task Task[T]) {
	wp.taskQueue <- task
}

// SubmitBatch submits multiple tasks efficiently
func (wp *WorkerPool[T]) SubmitBatch(tasks []Task[T]) {
	for _, task := range tasks {
		wp.taskQueue <- task
	}
}

// Stop gracefully shuts down the worker pool
func (wp *WorkerPool[T]) Stop() {
	close(wp.taskQueue)
	wp.wg.Wait()
}

// WorkerCount returns the number of workers in the pool
func (wp *WorkerPool[T]) WorkerCount() int {
	return wp.workerCount
}

// ParallelProcessor handles parallel processing of items with result collection
type ParallelProcessor[I, R any] struct {
	workerCount int
}

// NewParallelProcessor creates a new parallel processor
func NewParallelProcessor[I, R any](workerCount int, itemCount int) *ParallelProcessor[I, R] {
	return &ParallelProcessor[I, R]{
		workerCount: workerCount,
	}
}

// Process processes all items in parallel using the provided function
func (pp *ParallelProcessor[I, R]) Process(ctx context.Context, items []I, processFunc func(I) R) []R {
	if len(items) == 0 {
		return []R{}
	}

	results := make([]R, len(items))
	var wg sync.WaitGroup

	// Create semaphore to limit concurrent workers
	semaphore := make(chan struct{}, pp.workerCount)

	for i, item := range items {
		wg.Add(1)
		go func(index int, itm I) {
			defer wg.Done()

			// Acquire semaphore
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			// Process item
			results[index] = processFunc(itm)
		}(i, item)
	}

	wg.Wait()
	return results
}

// ProcessBatch processes items in batches for better memory management
func (pp *ParallelProcessor[I, R]) ProcessBatch(ctx context.Context, items []I, processFunc func(I) R, batchSize int) []R {
	if batchSize <= 0 {
		batchSize = len(items)
	}

	var mu sync.Mutex
	results := make([]R, 0, len(items))

	// Process in batches to control memory usage
	for i := 0; i < len(items); i += batchSize {
		end := i + batchSize
		if end > len(items) {
			end = len(items)
		}

		batch := items[i:end]
		batchResults := make([]R, len(batch))

		// Process batch
		var batchWg sync.WaitGroup
		for j, item := range batch {
			batchWg.Add(1)
			go func(index int, itm I) {
				defer batchWg.Done()
				batchResults[index] = processFunc(itm)
			}(j, item)
		}

		batchWg.Wait()

		// Add batch results to final results
		mu.Lock()
		results = append(results, batchResults...)
		mu.Unlock()
	}

	return results
}