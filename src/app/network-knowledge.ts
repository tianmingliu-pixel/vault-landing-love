import type { NetNodeId } from "./network-topology";

export const netKnowledge = {
  residential: {
    code: "00 / HOME",
    principle: "A home gateway performs NAT and DHCP, translating one public IP address into many private addresses and issuing local addresses over Wi-Fi and Ethernet.",
    boundary: "The router is the trust boundary between an open home LAN and the public Internet; weak defaults such as open admin panels, UPnP, or unrotated credentials collapse that boundary.",
    verification: "Check for internet-facing admin interfaces, default credentials, open UPnP port mappings, and firmware update currency.",
    steps: ["LAN", "NAT", "WAN"],
  },
  enterprise: {
    code: "01 / ENTERPRISE",
    principle: "Enterprise networks segment traffic into VLANs by department or trust level and route egress through managed firewalls and proxies.",
    boundary: "Segmentation only holds if inter-VLAN routing and firewall rules are enforced consistently; a flat network erases the intended boundary.",
    verification: "Attempt lateral movement across VLANs and confirm egress filtering blocks disallowed destinations and protocols.",
    steps: ["VLAN", "FIREWALL", "EGRESS"],
  },
  government: {
    code: "02 / GOVERNMENT",
    principle: "Government networks often isolate sensitive systems on dedicated or air-gapped segments, applying stricter compliance and change-control regimes.",
    boundary: "Isolation is only as strong as its interconnection points; any bridge between a sensitive enclave and the public Internet becomes the real boundary.",
    verification: "Confirm sensitive systems are not directly internet-routable and audit any bridging or remote-access paths.",
    steps: ["ENCLAVE", "CONTROL", "AUDIT"],
  },
  public: {
    code: "03 / PUBLIC",
    principle: "Public institutions such as libraries, campuses, and transit Wi-Fi offer open or captive-portal access, isolating guest clients from administrative systems.",
    boundary: "Client isolation on the public SSID must prevent guest devices from reaching each other or the institution's internal VLAN.",
    verification: "Test client-to-client visibility on the public network and confirm the administrative network is unreachable from it.",
    steps: ["PORTAL", "ISOLATE", "GUEST"],
  },
  private: {
    code: "04 / PRIVATE",
    principle: "Private data centers and colocation facilities connect via dedicated or leased lines with redundant power, cooling, and physical access control.",
    boundary: "In shared colocation, only strict physical and logical tenant isolation prevents one customer's rack or VLAN from reaching another's.",
    verification: "Test cross-tenant network isolation and confirm physical access logging for shared cages and rows.",
    steps: ["RACK", "ISOLATE", "REDUNDANCY"],
  },
  access: {
    code: "05 / ACCESS",
    principle: "The access network is the last mile: fiber (PON), cable (DOCSIS), or DSL encodes IP traffic between the customer premises and the ISP's edge equipment.",
    boundary: "Provider-owned equipment sits inside the trust path; a compromised or misconfigured access node can observe or redirect customer traffic.",
    verification: "Check whether ISP-side access equipment exposes management interfaces reachable from the customer segment.",
    steps: ["ENCODE", "LAST-MILE", "HANDOFF"],
  },
  tower: {
    code: "06 / RADIO",
    principle: "A cell tower's radio access network authenticates mobile devices over cellular standards and backhauls their traffic to the mobile core.",
    boundary: "Both the over-the-air link and the backhaul link must be authenticated and encrypted; a weak link at either point exposes the session.",
    verification: "Verify SIM or identity authentication on the radio link and encryption on the backhaul connection to the core network.",
    steps: ["RADIO", "AUTH", "BACKHAUL"],
  },
  isp: {
    code: "07 / ISP EDGE",
    principle: "ISP edge routers aggregate many customer sessions, apply per-customer policy, and hand traffic off to the routing core.",
    boundary: "Customer sessions must stay isolated on shared access media; session tagging is what keeps one customer from seeing another's traffic.",
    verification: "On shared access media, attempt to observe or inject into a neighboring customer's session.",
    steps: ["AGGREGATE", "POLICY", "ROUTE"],
  },
  ixp: {
    code: "08 / IXP",
    principle: "An Internet Exchange Point is a neutral facility where many networks connect to a shared switching fabric and exchange routes directly through peering.",
    boundary: "Peering only exchanges the routes each party agrees to announce; exchanging a route is not the same as trusting its origin.",
    verification: "Check whether route origin validation, such as RPKI, is applied to routes learned at the exchange.",
    steps: ["PEER", "EXCHANGE", "FILTER"],
  },
  backbone: {
    code: "09 / BACKBONE",
    principle: "Tier 1 backbone networks interconnect through BGP, forming a default-free zone that does not need to purchase transit from any other network.",
    boundary: "BGP is a trust-based announcement protocol; a network is only as trustworthy as the validation applied to the routes it announces.",
    verification: "Check for BGP origin validation, route filtering, and monitoring for hijacks or route leaks.",
    steps: ["ANNOUNCE", "PROPAGATE", "CONVERGE"],
  },
  cable: {
    code: "10 / CABLE",
    principle: "Submarine and long-haul terrestrial fiber carries wavelength-multiplexed light between landing stations, forming the physical links between regions.",
    boundary: "Physical damage, landing-station compromise, or a lack of route diversity concentrates risk onto a small number of physical paths.",
    verification: "Confirm route diversity across independent physical paths and review landing-station physical security.",
    steps: ["FIBER", "LANDING", "DIVERSITY"],
  },
  dns: {
    code: "11 / DNS",
    principle: "DNS resolves names to addresses through a hierarchy: root servers delegate to TLD servers, which delegate to authoritative servers for a domain.",
    boundary: "An unvalidated response is only a claim, not a fact; without DNSSEC, a resolver cannot cryptographically verify the answer's origin.",
    verification: "Test resolution against spoofed or poisoned responses and confirm DNSSEC validation is enforced.",
    steps: ["ROOT", "TLD", "AUTHORITATIVE"],
  },
  cdn: {
    code: "12 / CDN",
    principle: "A content delivery network caches content at edge nodes near users, often using anycast routing to direct requests to the nearest healthy node.",
    boundary: "Cached content and cache keys must stay isolated between tenants; the edge is also commonly the first layer for WAF and DDoS mitigation.",
    verification: "Test for cache poisoning, cross-tenant cache key collisions, and whether the edge WAF blocks disallowed request classes.",
    steps: ["CACHE", "ANYCAST", "INVALIDATE"],
  },
} as const satisfies Record<NetNodeId, { code: string; principle: string; boundary: string; verification: string; steps: readonly string[] }>;

export function hubKnowledge(city: string) {
  return {
    code: `HUB / ${city.toUpperCase()}`,
    principle: `${city} functions as a regional internet hub: a concentration of Internet Exchange Points, ISP points-of-presence, and cable landing infrastructure that peers traffic for its region.`,
    boundary: `Hub concentration is efficient but creates a regional dependency; if ${city}'s facilities are disrupted, traffic must reroute through alternate hubs.`,
    verification: `Confirm alternate physical paths exist so that traffic through ${city} can reroute if this hub becomes unreachable.`,
  };
}
