package config

import (
	"os"
	"strconv"
)

// Config holds all configuration variables for Pulse API and Worker.
type Config struct {
	Port               string
	WorkerConcurrency  int
	CheckIntervalSec   int
	FirestoreProjectID string
	CredentialsFile    string
	StoreType          string // "firestore" or "memory"
	AllowedOrigins     string
	Environment        string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		Port:               getEnv("PORT", "8080"),
		WorkerConcurrency:  getEnvInt("WORKER_CONCURRENCY", 20),
		CheckIntervalSec:   getEnvInt("CHECK_INTERVAL_SEC", 10),
		FirestoreProjectID: getEnv("FIRESTORE_PROJECT_ID", "pulse-dev"),
		CredentialsFile:    getEnv("GOOGLE_APPLICATION_CREDENTIALS", ""),
		StoreType:          getEnv("STORE_TYPE", "memory"),
		AllowedOrigins:     getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
		Environment:        getEnv("PULSE_ENV", "development"),
	}
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		if parsed, err := strconv.Atoi(val); err == nil {
			return parsed
		}
	}
	return defaultVal
}
