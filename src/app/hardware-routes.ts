export const hardwareRoutes = [
  { id: "nvme-cpu", label: "NVMe → CPU", kind: "data", detail: "SSD reads enter the system through the NVMe / PCIe storage path. The CPU prepares files and moves working data into memory." },
  { id: "cpu-ram", label: "CPU ↔ DDR5", kind: "data", detail: "The memory controller exchanges active data with DDR5 RAM. Dataset batches, decoded frames, and compiler state are staged here." },
  { id: "cpu-gpu", label: "CPU → GPU", kind: "data", detail: "PCIe transfers prepared data and commands to GPU VRAM. The GPU executes parallel rendering and model operations." },
  { id: "psu-cpu", label: "PSU → CPU", kind: "power", detail: "The power supply feeds the motherboard voltage regulators, which deliver regulated power to the processor." },
  { id: "psu-gpu", label: "PSU → GPU", kind: "power", detail: "Dedicated power cabling supplies the graphics card independently of its PCIe data path." },
  { id: "cpu-loop", label: "CPU → coolant", kind: "thermal", detail: "Heat moves from the CPU into the cooler's cold plate and liquid loop." },
  { id: "loop-radiator", label: "Coolant → radiator", kind: "thermal", detail: "The radiator transfers heat from the coolant to air moved by its fans." },
] as const;

export type HardwareRouteId = (typeof hardwareRoutes)[number]["id"];

export const workloads = [
  { id: "ai", label: "AI Training", software: "PyTorch / Local Models", flow: "Read datasets → CPU decoding and batching → DDR5 staging → PCIe transfer → GPU parallel compute", routeIds: ["nvme-cpu", "cpu-ram", "cpu-gpu", "psu-cpu", "psu-gpu", "cpu-loop", "loop-radiator"] },
  { id: "video", label: "Video Editing", software: "DaVinci Resolve / Video Editor", flow: "Media files → CPU decoding and timeline → DDR5 frame cache → GPU effects and output", routeIds: ["nvme-cpu", "cpu-ram", "cpu-gpu", "psu-cpu", "psu-gpu"] },
  { id: "render", label: "3D Rendering", software: "Blender / 3D Scenes", flow: "Scene assets → CPU scene setup → DDR5 geometry data → GPU rasterization or rendering", routeIds: ["nvme-cpu", "cpu-ram", "cpu-gpu", "psu-cpu", "psu-gpu", "cpu-loop"] },
  { id: "compile", label: "Engineering Builds", software: "Compiler / Build System", flow: "Source files → CPU parallel compilation → DDR5 intermediate state → NVMe build artifacts", routeIds: ["nvme-cpu", "cpu-ram", "psu-cpu", "cpu-loop", "loop-radiator"] },
] as const satisfies readonly { id: string; label: string; software: string; flow: string; routeIds: readonly HardwareRouteId[] }[];