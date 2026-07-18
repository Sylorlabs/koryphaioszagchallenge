# Native rendering and GPU boundary

Koryphaios records a bounded typed scene in Zag. `src/native/scene_fb.zag`
executes the scene as the deterministic CPU oracle, and
`src/native/scene_gpu.zag` lowers it to a versioned, bounded Zag GPU packet.
Product UI code never calls a platform graphics API directly.

The ownership boundary is strict:

- Zag owns the UI and scene model, GPU IR, optimization, target codegen,
  proof-carrying kernel bundles, command construction, userspace memory and
  queue policy, synchronization, validation, diagnostics, and recovery.
- The operating system or hardware vendor owns only the privileged kernel GPU
  driver, firmware, PCIe, interrupts, power, display, and device reset.
- The runtime does not depend on Vulkan, OpenGL, OpenCL, CUDA, Level Zero,
  Mesa, or libdrm.

## Accelerated path

The production path is:

1. UI widgets record a backend-neutral typed scene.
2. The Zag compositor lowers it to Zag GPU resources and render passes.
3. Zag's GPU compiler lowers its own IR to a validated native target ISA.
4. A Zag-owned userspace adapter calls the kernel driver's render-node UAPI
   directly for buffer allocation, GPU virtual memory, queues, submissions,
   fences, and presentation.
5. Exact readback and CPU-oracle comparison certify each promoted operation.
6. Any unsupported capability, validation failure, timeout, or device loss
   fails closed to the CPU recovery surface.

MLIR may serve as an internal compiler interchange and optimization layer. It
is not a runtime, driver ABI, or cross-GPU submission mechanism. Each GPU family
still needs Zag-native ISA lowering plus a thin adapter for its kernel UAPI.
That is substantially smaller than implementing a kernel driver, but it cannot
be made completely vendor-independent.

## Current evidence

The sibling Zag source implements a reviewed GFX10.1 compiler target that emits
native RDNA1 `ZGK1` bundles for bounded fill, depth, and blend kernels. Its
strict virtual command processor validates the complete supported ISA and PM4
stream, enforces memory bounds, ownership transitions, and exact fences, then
executes against caller-owned memory. The compiler and virtual-runtime suites
pass.

Koryphaios emits its deterministic scene packet and keeps the CPU renderer
authoritative. Its first direct kernel-UAPI slice now opens the live render node
with raw Zag syscalls, identifies the `amdgpu` DRM driver, and queries live GFX
and compute IP/ring capabilities with `AMDGPU_INFO`. A bounded memory-only gate
also verifies Navi10 device identity, active CUs, wave size, and GPUVM range and
alignment values reported directly by the kernel. The memory gate
creates one 4 KiB GTT buffer, maps it, verifies exact CPU write/readback,
unmaps it, and closes the GEM handle. It links no userspace GPU library and
creates no context or submission. The remaining AMDGPU GPUVM, queue, fence,
and presentation adapter is not implemented yet, so the UI
and diagnostics explicitly report `E_GPU_DIRECT_DRM_INCOMPLETE`; no physical
GPU execution or accelerated-frame claim is made.

## Non-goals

- Reimplementing privileged kernel GPU drivers or firmware.
- Using a third-party userspace graphics or compute API as Zag's backend.
- Treating generated MLIR or native machine code as proof of physical execution.
- Promoting shader execution on the display-bound GPU without explicit risk acknowledgement and
  bounded certification evidence.
