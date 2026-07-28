package mspdi

import (
	"fmt"
	"regexp"
	"strconv"
	"time"
)

// durationPattern matches the ISO-8601 duration subset MSPDI emits, e.g.
// "PT88H0M0S" or "P1DT8H0M0S". All components are optional except the
// leading "P".
var durationPattern = regexp.MustCompile(`^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$`)

// parseISODuration converts an MSPDI duration string into a time.Duration.
// An empty string yields zero duration.
func parseISODuration(s string) (time.Duration, error) {
	if s == "" {
		return 0, nil
	}

	m := durationPattern.FindStringSubmatch(s)
	if m == nil {
		return 0, fmt.Errorf("mspdi: invalid duration %q", s)
	}

	var total time.Duration
	if m[1] != "" {
		days, _ := strconv.Atoi(m[1])
		total += time.Duration(days) * 24 * time.Hour
	}
	if m[2] != "" {
		hours, _ := strconv.Atoi(m[2])
		total += time.Duration(hours) * time.Hour
	}
	if m[3] != "" {
		minutes, _ := strconv.Atoi(m[3])
		total += time.Duration(minutes) * time.Minute
	}
	if m[4] != "" {
		seconds, _ := strconv.ParseFloat(m[4], 64)
		total += time.Duration(seconds * float64(time.Second))
	}
	return total, nil
}
