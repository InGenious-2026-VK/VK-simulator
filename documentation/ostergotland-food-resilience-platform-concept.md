# Östergötland Food Supply Chain Resilience Platform
### Concept & Architecture Document

Prepared for: Vreta Kluster, Östergötland municipalities, Länsstyrelsen Östergötland, and partners in the InGenious 2026 programme
Prepared by: Tharindu (InGenious-2026-VK)
Date: September 2026

---

## 1. Executive Summary

Östergötland needs a shared, visual picture of how food actually moves through the region — from field to storage to transport to plate — and of where that system is fragile. This document proposes a **digital platform that visualises Östergötland's food supply chain as a stack of interactive map layers**: production, processing, storage, logistics, energy and water dependencies, and demand. Layered together, these let planners see not just *what* exists, but *how it depends on what else* — so that a disruption (a blocked road, a lost power connection, a fuel shortage) can be traced through to its effect on food reaching people.

The timing is deliberate. In July 2026 the Swedish government adopted its first national **supply preparedness strategy** (försörjningsberedskap), explicitly built around the 2024 total defence decision and the 2025–2030 defence period, with food and drinking water named as priority areas. In May 2026, Sweden's county governors met in Linköping specifically to discuss total defence and food supply — putting Östergötland at the centre of this conversation. And Östergötland already has its own regional food strategy roadmap, *Från östgötsk jord till våra bord*, whose fourth pillar is explicitly "security and resilience." What Östergötland does not yet have is a shared operational tool that turns these strategies into something planners, producers, and civil-defence actors can actually look at, query, and plan against together.

This platform is proposed as an **InGenious 2026 project**, connecting Linköping University's Student Innovation programme with Vreta Kluster as the anchoring organisation for the region's green industries, and with municipalities and Länsstyrelsen Östergötland as the intended operational users.

---

## 2. Why Now: The Case for This Platform

Three threads have converged in the past year, and Östergötland sits at the intersection of all three:

**National policy has moved from principle to plan.** Sweden's new supply preparedness strategy sets three concrete goals — keep supply flows running, compensate for market disruptions, and prioritise resources under shortage — and names 19 priority actions, including joint public-private exercises, better information-sharing, and stronger logistics-chain robustness across transport, energy, and communications. A regional platform that makes the food system visible is direct, practical infrastructure for exactly this kind of joint planning.

**Östergötland has already named resilience as a strategic goal, on paper.** The region's food strategy roadmap calls for "robust production systems to reduce vulnerability" and states plainly that supply security is *allas ansvar* — everyone's responsibility, requiring coordination between regional authorities, municipalities, and industry. That coordination currently has no shared visual or data layer to work from.

**Vreta Kluster is the natural hub.** As Östergötland's development centre for the green industries — agriculture, food production, forestry, and renewable energy — Vreta Kluster already convenes the producers, researchers, and companies whose data and cooperation this platform would depend on. It is where "industry and research meet and interact," which is precisely the meeting point a resilience-planning tool needs.

Put together: the policy mandate exists, the regional strategy exists, and the convening organisation exists. What's missing is the tool that lets them act on the same picture of reality.

---

## 3. Vision & Objectives

**Vision:** A living map of Östergötland's food system that lets planners, producers, and crisis-response authorities see how food actually flows through the region today, and reason about what would happen to that flow under stress — whether the stress is a fuel shortage, a severed transport link, extreme weather, or wartime disruption.

**Objectives:**

- Make the region's food supply chain *visible* — currently the knowledge of where production, storage, and distribution actually sit is scattered across producers, municipalities, and agencies, not held anywhere as one picture.
- Make *dependencies* visible, not just locations — a dairy's output depends on feed transport, electricity, and a working cold chain; the map should show those links, not just pins on a map.
- Give regional and municipal planners a shared basis for **peacetime investment decisions** (where is storage capacity thin? where is the region overly dependent on a single road or a single supplier?).
- Give civil-defence and total-defence planners a tool for **scenario and continuity planning** consistent with the national supply preparedness strategy.
- Do this in a way that strengthens, rather than duplicates, the work already defined in Östergötland's food strategy roadmap and Vreta Kluster's existing network.

---

## 4. The Platform Concept

At its core, the platform is a **map of Östergötland with switchable, combinable layers** — the same interaction model as a GIS tool, but purpose-built for food-system planning rather than general mapping. A user can turn layers on and off, or view several together, to ask questions like: *if this bridge is out, which processing facilities lose access to which farms? If this substation goes down, which cold-storage sites are affected, and how many people depend on the food that passes through them?*

Two views are intended to sit on top of the same layered data:

- **A planning view**, open to municipalities, Vreta Kluster members, and regional planners, for everyday use in investment and strategy discussions — aligned with the food strategy roadmap's "competitiveness" and "public procurement" goals.
- **A resilience/scenario view**, with more restricted access, for Länsstyrelsen Östergötland, MSB-aligned civil-defence planners, and total-defence exercises — where sensitive detail (exact capacities, single points of failure) is visible only to those with a legitimate planning need. Section 10 addresses why this split matters.

---

## 5. Data Layers

The platform's value comes from layering these together, not from any single one in isolation:

- **Primary production** — farms, crop types and areas, livestock operations, greenhouses and horticulture, drawn from Jordbruksverket's agricultural block and holding data.
- **Processing & storage** — dairies, slaughterhouses, mills, bakeries, grain silos, cold storage and warehousing — including capacity where it can be responsibly shared.
- **Logistics & transport** — road, rail, and port infrastructure relevant to food movement, overlaid with Trafikverket network data, to show which links carry the most food-supply traffic and which facilities have only one route in or out.
- **Energy & water dependencies** — electricity substations, fuel depots, and water supply infrastructure that processing, cold storage, and irrigation depend on. This is the layer that turns "a substation is down" into "these food facilities are affected."
- **Population & demand** — population density and municipal boundaries (SCB), to connect supply points to the people who depend on them, and to identify areas that would be hardest hit by a local disruption.
- **Vulnerability & risk overlays** — a derived layer, built from the others, highlighting single points of failure, chokepoints, and areas of thin redundancy — the "so what" layer that the rest of the map exists to produce.

Each layer is intended to draw on existing open or semi-open Swedish data infrastructure wherever possible — Jordbruksverket, Lantmäteriet, and SCB all publish open geodata — supplemented by data that Vreta Kluster's own network of producers and companies can contribute, and by infrastructure data held by Länsstyrelsen and relevant agencies under appropriate agreements.

---

## 6. Core Use Cases

**Peacetime planning.** A municipality considering where to support new storage capacity, or a producer considering where to locate a new facility, can see current capacity, transport access, and demand concentration together — turning the roadmap's "competitiveness" goal into a decision-support tool rather than a strategy document.

**Disruption simulation.** A planner asks "what if this road is closed" or "what if this substation fails" and sees, layer by layer, which parts of the food system are affected — the kind of joint exercise the national strategy calls for, made concrete and repeatable rather than a one-off tabletop exercise.

**Wartime / total-defence continuity planning.** Under the restricted resilience view, civil-defence planners can identify which facilities and routes are critical enough to warrant redundancy, protection, or contingency stockpiling — directly supporting the priorities set out in the July 2026 national supply preparedness strategy and the discussions among county governors in May 2026.

**Cross-stakeholder coordination.** Because producers, municipalities, Vreta Kluster, and Länsstyrelsen are looking at the same map rather than separate spreadsheets and reports, the roadmap's principle that resilience is "everyone's responsibility" has a shared artefact to coordinate around.

---

## 7. Stakeholder Value

- **Vreta Kluster** gains a flagship platform that showcases and strengthens its convening role across the green industries, and a concrete artefact to bring to its member network and national/international partners.
- **Farmers and food-sector companies** get visibility into how their operations fit into regional resilience planning, and a channel to be recognised and supported rather than treated as an afterthought in crisis planning.
- **Municipalities** get a shared, visual basis for local investment and preparedness decisions that doesn't require building their own GIS capability from scratch.
- **Länsstyrelsen Östergötland and total-defence planners** get a tool purpose-built for the food-and-water resilience conversation the county governors were already having in May 2026, rather than adapting general-purpose GIS tools.
- **Linköping University and InGenious** get a real, high-stakes regional challenge with a clear organisational partner (Vreta Kluster) and a natural multi-year runway — pilot in one semester, deepen in the next.

---

## 8. High-Level System Architecture

At the concept level, the platform has four functional layers (deliberately described here without committing to specific technologies, so the choice of GIS engine, database, and hosting can be made once data-access agreements with partners are clearer):

1. **Data layer** — ingests and stores the geospatial and attribute data for each map layer, from both open sources (Jordbruksverket, Lantmäteriet, SCB) and partner-contributed sources (Vreta Kluster network, municipalities, Länsstyrelsen).
2. **Map & visualisation layer** — the interactive map interface itself: layer toggling, zoom from region down to facility level, and combined-layer views.
3. **Scenario & analysis layer** — the logic that lets a user simulate "remove this node/link" and see downstream effects, and that derives the vulnerability overlay from the underlying layers.
4. **Access & governance layer** — controls who sees what: the open planning view versus the restricted resilience view described in Section 4, with authentication and audit logging for the sensitive layers.

This structure is intended to let the project start small (a public planning view built entirely on open data) and grow into the more sensitive resilience-planning capability as data-sharing agreements and security review catch up — see the roadmap below.

---

## 9. Governance, Security & Trust

A platform that maps food-critical infrastructure for wartime planning is, by its own logic, a platform that would be valuable to an adversary if it were fully open. This needs to be designed in from the start, not added later:

- **Tiered access from day one.** The public/planning view should never contain the level of detail (exact capacities, single-supplier dependencies, specific vulnerability findings) that the restricted resilience view does.
- **Data-sharing agreements, not scraping.** Sensitive infrastructure and capacity data should be contributed under explicit agreement with each data owner (municipalities, companies, agencies), not inferred or aggregated from public sources in a way that reconstructs what those owners chose not to publish.
- **Alignment with existing classification practice.** Länsstyrelsen and MSB already have frameworks for handling security-sensitive information in civil-defence contexts; the platform's restricted layer should be built to fit inside that practice rather than invent a parallel one.
- **This is a genuine open design question, not a footnote** — it should be raised directly with Länsstyrelsen Östergötland and, if relevant, MSB, early in the project, before detailed infrastructure data is collected.

---

## 10. Data Sources & Prospective Partners

- **Jordbruksverket** — agricultural holdings, crop and livestock data, open geodata and GIS services.
- **Lantmäteriet** — base maps, property, and terrain data (open data programme).
- **SCB (Statistics Sweden)** — population, municipal boundaries, and open geodata.
- **Länsstyrelsen Östergötland** — regional food strategy data, civil-defence and preparedness context.
- **Vreta Kluster network** — producer, processor, and green-industry company data and relationships.
- **Municipalities in Östergötland** — local infrastructure, storage, and procurement data.
- **Trafikverket** — transport network data for the logistics layer.
- **Livsmedelsverket and MSB** — national food-safety and preparedness frameworks the platform should align with, and potential guidance on the restricted resilience layer.

---

## 11. Roadmap

**Phase 1 — Pilot (one InGenious semester).** Build the public planning view for a limited area of Östergötland, using only open data (Jordbruksverket, Lantmäteriet, SCB): production, processing/storage locations, and transport layers. Validate the concept with Vreta Kluster and one or two municipalities.

**Phase 2 — Deepen data & partners.** Bring in producer- and company-contributed data through Vreta Kluster's network, add the energy/water dependency layer, and extend municipal coverage across the region.

**Phase 3 — Resilience layer.** Working directly with Länsstyrelsen Östergötland (and MSB where relevant), build the restricted scenario/vulnerability view under an agreed governance and access model, and run a first joint planning exercise consistent with the national supply preparedness strategy's call for joint exercises.

**Phase 4 — Scale.** If successful, the model — data structure, layer design, governance split — is positioned as a template other Swedish regions could adopt, given that the national strategy applies the same total-defence logic nationwide.

---

## 12. Fit with InGenious 2026

InGenious is Linköping University's Challenge-Based Learning programme, connecting student teams with real organisational challenges over the autumn semester. This project is well suited to that format: Vreta Kluster is a credible organisational challenge-owner already embedded in the region's green-industry network, the problem is real and current (not manufactured for the course), and Phase 1 above is scoped to fit a single semester's worth of work while leaving a clear path to a multi-year platform.

---

## 13. Next Steps

1. Confirm Vreta Kluster's role as challenge-owner/partner and identify a first municipal pilot partner.
2. Scope Phase 1's exact geographic area and layer set against what's realistically buildable with open data alone in one semester.
3. Open an early conversation with Länsstyrelsen Östergötland about the eventual resilience layer and its governance — before, not after, sensitive data collection begins.
4. Draft the InGenious challenge brief from this document for the autumn intake.
