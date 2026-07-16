# Native performance gate

`--performance-selftest` measures native-core startup and 120 software-rendered
frames after populating the immutable event feed with 10,000 entries.
`tools/performance-gate.sh` additionally records peak resident memory with the
system `time` utility.

Timing uses `CLOCK_MONOTONIC` at microsecond resolution. The blocking thresholds are:

- startup below 750 ms;
- worst measured framebuffer render at or below 16 ms;
- peak RSS below 128 MiB;
- at least 10,000 feed events retained while rendering remains bounded to the
  visible tail.

This gate does not yet prove idle CPU under a live X11 compositor, input-to-X11
present latency, or release-machine p95 latency. Those remain release-profile
evidence rather than being inferred from the headless renderer.
