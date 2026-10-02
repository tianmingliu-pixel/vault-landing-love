export type Medium = "wired" | "wireless";

export const mediumColors: Record<Medium, string> = { wired: "#3fc6d6", wireless: "#f2b954" };

export const sectors = [
  { id: "residential", label: "Residential Home", description: "A household network behind a consumer router; typically NAT plus Wi-Fi with minimal internal segmentation." },
  { id: "enterprise", label: "Enterprise Network", description: "A business network with managed switches, VLAN segmentation, and controlled egress through firewalls or proxies." },
  { id: "government", label: "Government Network", description: "A public-sector network, often isolating sensitive systems with stricter compliance and change control." },
  { id: "public", label: "Public Institution", description: "Libraries, campuses, and public Wi-Fi, isolating guest clients from administrative systems." },
  { id: "private", label: "Private Data Center", description: "A privately operated facility with dedicated links, redundant power, and physical access control." },
] as const;

export const infraNodes = [
  { id: "access", label: "Access Network", description: "Last-mile delivery over fiber, cable, or DSL between the customer premises and the ISP." },
  { id: "tower", label: "Cell Tower / RAN", description: "Radio access network delivering mobile and fixed-wireless connectivity to devices." },
  { id: "isp", label: "ISP Edge", description: "Regional aggregation and per-customer routing operated by an Internet Service Provider." },
  { id: "ixp", label: "Internet Exchange Point", description: "A neutral facility where independent networks interconnect and exchange routes directly." },
  { id: "backbone", label: "Tier 1 Backbone", description: "Global, transit-free networks interconnected through BGP peering." },
  { id: "cable", label: "Submarine / Long-haul Cable", description: "Physical fiber routes carrying traffic between regions and across oceans." },
  { id: "dns", label: "DNS Resolution", description: "Hierarchical name resolution from root servers to authoritative records." },
  { id: "cdn", label: "CDN Edge Cache", description: "Cached content served from nodes positioned close to users to reduce latency." },
] as const;

export type SectorId = (typeof sectors)[number]["id"];
export type InfraId = (typeof infraNodes)[number]["id"];
export type NetNodeId = SectorId | InfraId;

export const allNetNodes: readonly { id: NetNodeId; label: string; description: string }[] = [...sectors, ...infraNodes];

export const netEdges = [
  { id: "residential-access", from: "residential", to: "access", medium: "wired" },
  { id: "residential-tower", from: "residential", to: "tower", medium: "wireless" },
  { id: "enterprise-access", from: "enterprise", to: "access", medium: "wired" },
  { id: "government-access", from: "government", to: "access", medium: "wired" },
  { id: "public-tower", from: "public", to: "tower", medium: "wireless" },
  { id: "public-access", from: "public", to: "access", medium: "wired" },
  { id: "private-access", from: "private", to: "access", medium: "wired" },
  { id: "access-isp", from: "access", to: "isp", medium: "wired" },
  { id: "tower-isp", from: "tower", to: "isp", medium: "wireless" },
  { id: "isp-dns", from: "isp", to: "dns", medium: "wired" },
  { id: "isp-cdn", from: "isp", to: "cdn", medium: "wired" },
  { id: "isp-ixp", from: "isp", to: "ixp", medium: "wired" },
  { id: "ixp-backbone", from: "ixp", to: "backbone", medium: "wired" },
  { id: "backbone-cable", from: "backbone", to: "cable", medium: "wired" },
] as const satisfies readonly { id: string; from: NetNodeId; to: NetNodeId; medium: Medium }[];

export type NetEdgeId = (typeof netEdges)[number]["id"];

// Percent coordinates (0-100) inside a 100x100 viewBox; shared by node placement and SVG edges.
export const layout: Record<NetNodeId, { x: number; y: number }> = {
  residential: { x: 6, y: 8 },
  enterprise: { x: 6, y: 26 },
  government: { x: 6, y: 44 },
  public: { x: 6, y: 62 },
  private: { x: 6, y: 80 },
  access: { x: 27, y: 34 },
  tower: { x: 27, y: 68 },
  isp: { x: 46, y: 51 },
  dns: { x: 46, y: 18 },
  cdn: { x: 46, y: 84 },
  ixp: { x: 65, y: 51 },
  backbone: { x: 82, y: 51 },
  cable: { x: 96, y: 51 },
};
