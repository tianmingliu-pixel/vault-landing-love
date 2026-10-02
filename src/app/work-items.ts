export const workItems = [
  {
    slug: "computer-hardware-atlas",
    title: "Computer Hardware Atlas",
    body: "solution 2:Intel Core Ultra 9 285K、RTX 5090 hardware components for 3D creation interactive with local AI Image  workstation.",
    tag: "Hardware",
    highlights: [
      { title: "Core components", detail: "Identify the CPU, GPU, motherboard, and memory in a computer system." },
      { title: "Storage and power", detail: "Compare common drives, power supplies, and their physical connections." },
      { title: "Cooling and I/O", detail: "Explore cooling hardware and the devices that connect a computer to the outside world." },
    ],
  },
  {
    slug: "local-llm-hardening",
    title: "traditional LLM Hardening concepts",
    body: "Found an over-permissive CORS setting on a local LLM server, traced the drive-by attack path, and wrote the fix and verification steps.",
    tag: "Principles of LLM ",
    highlights: [
      { title: "Finding", detail: "Identified an over-permissive CORS setting on a local LLM server." },
      { title: "Risk", detail: "Traced how a drive-by browser request could interact with the local service." },
      { title: "Remediation", detail: "Wrote the configuration fix and steps to verify that the attack path is closed." },
    ],
  },
  {
    slug: "network-concept",
    title: "Network Concept",
    body: "How the Internet moves a packet: from home, enterprise, government and public networks, through radio towers and access fibre, to exchanges, backbones and submarine cables — in interactive 2D and 3D.",
    tag: "Internet infrastructure",
    highlights: [
      { title: "Access networks", detail: "Trace a packet hop by hop from where it starts to the global core, with the protocol used on each link." },
      { title: "Global interconnection", detail: "Explore real exchanges, cable-landing regions and corridors on a 3D globe or 2D map." },
      { title: "Physics of latency", detail: "See the great-circle distance and fibre round-trip floor for every intercontinental corridor." },
      { title: "Engineering principles", detail: "BGP trust, anycast, and why radio stays at the edge while fibre carries the core." },
    ],
  },
] as const;