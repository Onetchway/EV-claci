/**
 * The Franchise and Commercial Partnership Agreement's fixed legal text —
 * the 20 numbered clauses plus recitals, definitions and signature blocks.
 * Unlike the Letter of Intent, this is never edited per lead (it's the same
 * legal language for every deal); only Schedule I (see AGREEMENT_SCHEDULE_FIELDS
 * in constants.ts) varies. Sourced from the Livanto Standard Franchise
 * Agreement Template (FINAL).
 */

export interface AgreementClause {
  number: string;
  heading: string;
  paragraphs: string[];
}

export const AGREEMENT_RECITALS = [
  "Livanto is engaged in the business of installation, operation, and management of Electric Vehicle (EV) charging infrastructure across India under a Franchisee-Owned, Company-Operated (“FOCO”) model, whereby the Franchisee owns the Charging Station equipment and Livanto installs, operates, and manages the same, while the Franchisee provides access to the premises.",
  "The Franchisee owns, occupies, or otherwise controls the premises located at [SITE ADDRESS] (“Site”), and is desirous of hosting an EV charging station of [CHARGER TYPE & CAPACITY] (“Charging Station”) at the Site.",
  "The Parties now desire to enter into this Agreement to record their respective rights, obligations, and entitlements with respect to the installation, operation, commercial terms, branding, and management of the Charging Station at the Site, on the terms and conditions set out herein.",
];

export const AGREEMENT_CLAUSES: AgreementClause[] = [
  {
    number: "1", heading: "DEFINITIONS", paragraphs: [
      "1.1 “Agreement” means this Franchise and Commercial Partnership Agreement, including Schedule I hereto, as may be amended from time to time by written consent of the Parties.",
      "1.2 “Charging Station” means the EV charging equipment of [CHARGER TYPE & CAPACITY] installed by Livanto at the Site, together with all associated civil works, canopy, cabling, metering infrastructure, and related equipment.",
      "1.3 “Charging Management System / CMS” means Livanto’s OCPP-compliant Central Management System used for real-time monitoring, metering, billing, and remote management of all charging sessions at the Site.",
      "1.4 “Commercial Commissioning Date” means the date on which the Charging Station becomes operational and available for public/commercial use, as recorded in Schedule I.",
      "1.5 “Electricity Cost” means the cost per unit (kWh) of electricity procured for operation of the Charging Station, as specified in Schedule I, subject to revision as per Clause 5.4.",
      "1.6 “Livanto Fee” means Livanto’s operational service and management fee per unit (kWh) dispensed at the Charging Station, as specified in Schedule I, metered transparently through the CMS.",
      "1.7 “Minimum Assured Amount” means the minimum monthly amount payable by Livanto to the Franchisee per Charging Point, as specified in Schedule I, for the Payout Period.",
      "1.8 “Payout Period” means the period specified in Schedule I, commencing from the Commercial Commissioning Date, during which the Minimum Assured Amount is payable.",
      "1.9 “Public Selling Rate” means the rate per unit (kWh) charged to end-users at the Charging Station, as specified in Schedule I, subject to revision by Livanto from time to time in accordance with Clause 5.4.",
      "1.10 “Site” means the premises described in Recital B and Schedule I, where the Charging Station is installed and operated.",
      "1.11 “Tenure” or “Term” means the period specified in Schedule I, commencing from the Commercial Commissioning Date, subject to renewal or extension in accordance with Clause 13.",
      "1.12 “Buyback Price” means the price payable for the purchase of the charger by the Livanto from Franchisee upon exercise of the Exit and Buyback option under Clause 14, computed on the basis of the Original Equipment Cost less accumulated depreciation calculated on a straight-line basis at the Depreciation Rate specified in Schedule I, for the period from the Commercial Commissioning Date up to the date of the Exit Notice.",
      "1.13 “Original Equipment Cost” means the cost of procurement and installation of the charger unit alone (excluding civil works, canopy, cabling, metering infrastructure, and other Site-related setup costs), as specified in Schedule I.",
      "1.14 “Exit Notice” means the written notice issued by the Franchisee to Livanto under Clause 14, evidencing the Franchisee’s intention to exit this Agreement and exercise the Buyback Option.",
    ],
  },
  {
    number: "2", heading: "GRANT OF FRANCHISE", paragraphs: [
      "2.1 Subject to the terms of this Agreement, Livanto hereby grants to the Franchisee a non-exclusive, non-transferable, site-specific right to host the Charging Station at the Site for the duration of the Tenure, in consideration of the commercial arrangement set out in Clause 5 and Schedule I.",
      "2.2 The franchise granted hereunder is strictly limited to the Site specified in Schedule I. The Franchisee shall have no right to sub-license, assign, or otherwise transfer any rights conferred under this Agreement to any third party without Livanto’s prior written consent.",
      "2.3 The Franchisee shall own the Charging Station equipment (including the charger unit, canopy, cabling, and associated civil and electrical infrastructure) at all times, both during and after the Tenure, subject to Clause 13.4 and the Buyback and removal provisions of this Agreement. For the avoidance of doubt, ownership of the Livanto/CMS platform, software, and all associated intellectual property, including the Livanto brand, name, and marks, shall at all times remain vested solely in Livanto, and no title thereto shall pass to the Franchisee at any point during or after the Tenure.",
      "2.4 The grant of franchise hereunder does not confer any territorial exclusivity or right of first refusal in respect of other charging station opportunities of Livanto, except where expressly agreed in writing.",
    ],
  },
  {
    number: "3", heading: "TERM, TENURE AND COMMENCEMENT", paragraphs: [
      "3.1 This Agreement shall commence on the Effective Date and the Tenure shall be as specified in Schedule I, commencing from the Commercial Commissioning Date, unless earlier terminated in accordance with Clause 13.",
      "3.2 The Tenure may be extended by mutual written agreement of the Parties on such terms as may be agreed at that time. However, Livanto shall give the Franchisee a right of first refusal to extend the term for a further period equal to the Tenure, at the commercials prevailing as at the end of the initial Tenure. The Site shall be first offered to the Franchisee upon completion of the initial Tenure.",
      "3.3 Livanto shall undertake installation and commissioning of the Charging Station within [X] months or a mutually agreed timeframe following the Effective Date, and shall notify the Franchisee in writing of the Commercial Commissioning Date.",
      "3.4 Where this Agreement is not otherwise terminated or exited earlier, the Parties may, upon completion of the Tenure from the Commercial Commissioning Date, mutually agree to renew this Agreement for such further period as may be agreed, subject to continued availability of the Site (including continued right, title and interest of the Franchisee over the Site, or renewal of the underlying land/property arrangement, as applicable). The duration of any such renewal and the commercial terms applicable thereto shall be as mutually agreed and recorded in writing between the Parties at that time, and nothing in this Agreement obliges either Party to renew. However, Livanto shall give the Franchisee a right of first refusal to extend the term for a further period equal to the Tenure, at the commercials prevailing as at the end of the initial Tenure.",
    ],
  },
  {
    number: "4", heading: "CHARGING STATION AND SITE DETAILS", paragraphs: [
      "4.1 The type, capacity, and number of Charging Points to be installed at the Site are as specified in Schedule I.",
      "4.2 Livanto shall be responsible for the procurement, installation, and commissioning of the Charging Station, including all associated electrical infrastructure and DISCOM liaison, in accordance with applicable law.",
      "4.3 The Site is subject to feasibility and regulatory approval. Livanto may substitute the exact location of the Charging Station within the Site if the originally identified spot becomes unviable; this shall not be treated as a breach of this Agreement. If an alternate location is not offered by Livanto within a maximum of 30 days, or if the Franchisee is not satisfied with the alternate location, any money already received by Livanto from the Franchisee shall be immediately refunded to the Franchisee on demand.",
    ],
  },
  {
    number: "5", heading: "COMMERCIAL TERMS AND PAYMENT", paragraphs: [
      "5.1 The Franchisee shall be entitled to a Minimum Assured Amount as specified in Schedule I, per month per Charging Point, for the Payout Period.",
      "5.2 In the event that the revenue generated from charging operations at the Site is less than the Minimum Assured Amount in any given month, Livanto shall pay the difference amount to the Franchisee, subject to the maximum aggregate cap (if any) specified in Schedule I. This is a limited revenue-support mechanism and not a guaranteed return.",
      "5.3 Payments shall be settled on or before the date specified in Schedule I of each calendar month, for the preceding month.",
      "5.4 Livanto shall be entitled to deduct the Livanto Fee per kWh, as specified in Schedule I, towards software usage, backend services, operation, and management. Livanto may revise the Public Selling Rate.",
      "5.5 All payments are exclusive of applicable taxes (including GST) and TDS, which shall be accounted for in accordance with prevailing law. Both Parties acknowledge the commercial terms in Schedule I as a confirmed and binding commercial understanding.",
    ],
  },
  {
    number: "6", heading: "OBLIGATIONS OF LIVANTO", paragraphs: [
      "6.1 Livanto shall, throughout the Tenure, be responsible for: provision, installation, and commissioning of the Charging Station equipment; bearing all equipment, installation, insurance to cover fire, theft, earthquake, physical damage etc. and infrastructure costs; software integration, backend connectivity (CMS/OCPP), and payment gateway operations; operation, maintenance, technical support, and 24x7 remote monitoring of the Charging Station; obtaining and maintaining all necessary approvals, permits, licenses, and regulatory compliances required for installation and operation of the Charging Station; and providing the Franchisee with monthly operational and financial reports as set out in Clause 9.",
      "6.2 Livanto shall use commercially reasonable efforts to ensure timely maintenance and upkeep of the Charging Station, excluding downtime caused by Force Majeure Events, DISCOM supply failures, or factors beyond Livanto’s reasonable control.",
      "6.3 Livanto shall use commercially reasonable efforts to maintain the Charging Station in good working condition and to ensure reasonable uptime and availability of the Charging Station for public/commercial use, and shall attend within 24 hours to 48 hours and rectify reported malfunctions or outages within a reasonable time of 7 days, save for downtime attributable to Force Majeure, DISCOM supply failures, or factors beyond Livanto’s reasonable control.",
    ],
  },
  {
    number: "7", heading: "OBLIGATIONS OF THE FRANCHISEE", paragraphs: [
      "7.1 The Franchisee shall: provide and maintain reasonable access to the Site for installation, operation, and maintenance of the Charging Station in case of own land; support general site access, security, and infrastructure availability necessary for the Charging Station’s operation in case of own land; not interfere with, tamper with, or attempt to independently operate the Charging Station equipment, software, or infrastructure without Livanto’s prior written authorisation; and maintain confidentiality of all commercial, technical, and operational information shared under this Agreement, in accordance with Clause 10.",
    ],
  },
  {
    number: "8", heading: "BRANDING, LOGO DISPLAY, AND PRIMARY LOCATION PARTNER RECOGNITION", paragraphs: [
      "8.1 It is mutually understood and acknowledged that the Franchisee, being the owner/controller of the Asset, shall have no rights to display its name, logo, and branding at the Charging Station and premises, including at charging units, parking/charging bays, entry and exit points, and directional signage.",
      "8.2 The Franchisee shall be recognised as the Primary Location Partner. Livanto may display its own branding on the Charging Station and related platforms; such display shall not restrict or prevent the Franchisee.",
    ],
  },
  {
    number: "9", heading: "DATA TRANSPARENCY AND REPORTING", paragraphs: [
      "9.1 Livanto shall provide the Franchisee with monthly operational and financial reports relating to the Charging Station, including total electricity consumption (kWh), total revenue generated, Livanto Fee deductions, and the net payable amount, to ensure transparency and mutual understanding of the Charging Station’s performance.",
    ],
  },
  {
    number: "10", heading: "CONFIDENTIALITY", paragraphs: [
      "10.1 Both Parties agree to maintain confidentiality of all commercial, technical, and operational information shared under this Agreement, both during the Tenure and for two (2) years thereafter, and shall not disclose such information without prior written consent, except where required by law.",
    ],
  },
  {
    number: "11", heading: "INDEMNITY AND LIABILITY", paragraphs: [
      "11.1 Livanto shall be solely responsible for ensuring that the Charging Station complies with all applicable electrical, technical, and statutory safety standards, and for obtaining all necessary approvals, permits, and regulatory compliances.",
      "11.2 The Franchisee shall not be held responsible or liable for any technical malfunction, electrical fault, operational failure, accident, damage, injury, or legal claim arising from the installation, presence, or operation of the Charging Station equipment.",
      "11.3 Each Party (“Indemnifying Party”) shall indemnify, defend and hold harmless the other Party, its directors, officers, employees and representatives (“Indemnified Party”) from and against any losses, damages, liabilities, claims, costs and expenses (including reasonable legal fees) arising out of or in connection with: (i) any breach of this Agreement by the Indemnifying Party; (ii) any misrepresentation, negligence or wilful misconduct of the Indemnifying Party; or (iii) any third-party claim attributable to the Indemnifying Party's acts, omissions, or obligations under this Agreement, including, in the case of the Franchisee, claims relating to the Site or access thereto, and in the case of Livanto, claims relating to its services, operations, or obligations under this Agreement. Except for liability arising under Clause 5 (Confidentiality), fraud, wilful misconduct, gross negligence, or the indemnity obligations under this Agreement, each Party's aggregate liability under this Agreement shall not exceed the aggregate amounts paid or payable by Livanto to the Franchisee under Schedule I. In no event shall either Party be liable to the other for any indirect, incidental, special, exemplary, punitive, or consequential damages, including loss of profits, revenue, goodwill, or business opportunity, whether arising in contract, tort, or otherwise.",
    ],
  },
  {
    number: "12", heading: "DEFAULT AND NON-PAYMENT", paragraphs: [
      "12.1 Timely payment of the Minimum Assured Amount forms an essential part of this Agreement. In the event Livanto fails to make agreed payments for two (2) consecutive months, the Franchisee reserves the right to issue written notice and seek resolution through mutual discussion, and thereafter to pursue such other remedies as may be available in law, subject to Clause 13.",
      "12.2 Similarly, persistent failure by Livanto to maintain the Charging Station in accordance with the uptime and maintenance standard under Clause 6.3, continuing for a period of thirty (30) days or more after written notice from the Franchisee specifying the default, shall constitute a material breach entitling the Franchisee to the remedies set out in Clause 13.3.",
    ],
  },
  {
    number: "13", heading: "TERMINATION", paragraphs: [
      "13.1 Save as provided in Clauses 13.2, 13.3, and 18 (Force Majeure), neither Party shall be entitled to terminate this Agreement prior to completion of two (2) years from the Commercial Commissioning Date (“Lock-in Period”). Following expiry of the Lock-in Period, either Party may terminate this Agreement by providing sixty (60) days’ prior written notice to the other Party, provided that where such termination is at the instance of the Franchisee after completion of three (3) years from the Commercial Commissioning Date, the Franchisee may, at its option, exercise the Buyback Option under Clause 14 in lieu of removal of the Charging Station under Clause 13.4.",
      "13.2 Livanto may terminate this Agreement immediately on written notice if the Franchisee breaches a material term hereof and fails to remedy such breach within fifteen (15) days of notice, or denies access to the Site without valid cause.",
      "13.3 The Franchisee may terminate this Agreement by written notice to Livanto if Livanto: (a) fails to pay the Minimum Assured Amount for two (2) or more consecutive months in breach of Clause 12.1; or (b) commits a material and continuing breach of the uptime and maintenance standard under Clause 6.3, as set out in Clause 12.2; and, in either case, fails to remedy such default within thirty (30) days of written notice from the Franchisee specifying the default. On such termination, the Franchisee shall, in addition, be entitled to pursue such remedies as may be available in law for recovery of amounts due.",
      "13.4 On termination or expiry of this Agreement (other than pursuant to exercise of the Buyback Option under Clause 14), Livanto shall be entitled to remove the Charging Station equipment from the Site within a reasonable period, and the Franchisee shall provide reasonable access for such removal. Provisions relating to confidentiality, indemnity, and liability shall survive termination.",
    ],
  },
  {
    // Clauses 14.2–14.4 are absent in Livanto's source template (it jumps
    // 14.1 straight to 14.5) — reproduced as-is rather than inventing the
    // missing buyback mechanics.
    number: "14", heading: "EXIT OPTION AND BUYBACK OF CHARGING STATION", paragraphs: [
      "14.1 [X]% per annum (or as mutually agreed)",
      "14.5 Save as expressly provided in this Clause 14, the Franchisee shall have no right to purchase or otherwise acquire title to the Charging Station equipment or any other asset of Livanto at the Site under any other provision of this Agreement.",
    ],
  },
  {
    // The source template leaves this clause as a placeholder stub.
    number: "15", heading: "TRANSFER OF SITE BY FRANCHISEE TO THIRD PARTY", paragraphs: [
      "15.1 to be mutually agreed",
    ],
  },
  {
    number: "16", heading: "UPGRADATION OF CHARGING STATION / INFRASTRUCTURE", paragraphs: [
      "16.1 Livanto may, at its discretion or upon the request of the Franchisee, upgrade or augment the Charging Station (including higher-capacity chargers, additional Charging Points, or associated electrical/civil infrastructure) during the Tenure.",
      "16.2 Save as otherwise mutually agreed in writing, any capital or infrastructure cost associated with such upgradation undertaken at Livanto’s own discretion shall be borne by Livanto. Where such upgradation is undertaken at the specific request of the Franchisee, or necessitates additional civil, electrical, or infrastructure work at the Site beyond what was originally contemplated, the incremental cost thereof, and the manner of sharing the same, shall be discussed and mutually agreed in writing between the Parties prior to execution of such upgradation.",
      "16.3 Any upgradation under this Clause 16 shall not, by itself, alter the commercial terms recorded in Schedule I, except to the extent expressly agreed in writing by both Parties at the time of such upgradation.",
    ],
  },
  {
    number: "17", heading: "MUTUAL COOPERATION AND RELATIONSHIP MANAGEMENT", paragraphs: [
      "17.1 The Parties shall deal with each other in good faith and shall provide such reasonable cooperation and information as may be necessary for the smooth operation of the Charging Station and the effective implementation of this Agreement.",
      "17.2 Each Party shall designate a point of contact for day-to-day operational coordination. The Parties shall endeavour to communicate periodically (at least once every calendar quarter, or as otherwise mutually agreed) to review the performance of the Charging Station, discuss operational issues, and explore measures for mutual benefit.",
      "17.3 The Parties shall use reasonable efforts to resolve any dispute, grievance, or difference of opinion amicably through mutual discussion in the first instance, before resorting to the formal remedies available under Clause 13 or Clause 19 (Governing Law and Dispute Resolution).",
    ],
  },
  {
    number: "18", heading: "FORCE MAJEURE", paragraphs: [
      "18.1 Neither Party shall be liable for any failure or delay in performance caused by events beyond its reasonable control, including natural disasters, government restrictions, war, riots, pandemics, or grid/DISCOM failures. Livanto’s payment obligation under Clause 5 shall be suspended for so long as such event continues, and either Party may, notwithstanding the Lock-in Period under Clause 13.1, exit this Agreement by written notice if such event continues beyond ninety (90) days from the commencement of such event.",
    ],
  },
  {
    number: "19", heading: "GOVERNING LAW AND DISPUTE RESOLUTION", paragraphs: [
      "19.1 This Agreement shall be governed by the laws of India. Any dispute arising hereunder shall first be sought to be resolved amicably; failing which, it shall be referred to arbitration under the Arbitration and Conciliation Act, 1996, before a sole arbitrator appointed by mutual consent of Livanto and the Franchisee, seated at Lucknow, Uttar Pradesh (or such other seat as may be agreed in Schedule I).",
      "19.2 Subject to Clause 19.1, the courts at Lucknow, Uttar Pradesh shall have exclusive jurisdiction over all matters arising out of or in connection with this Agreement.",
    ],
  },
  {
    number: "20", heading: "GENERAL", paragraphs: [
      "20.1 This Agreement, together with Schedule I, constitutes the entire understanding between the Parties and supersedes all prior discussions, understandings, or agreements (including any MoU or LOI) relating to the subject matter herein. This Agreement may only be amended in writing signed by both Parties. Neither Party may assign its rights or obligations under this Agreement without the other Party’s prior written consent, except that Livanto may assign to an affiliate or successor entity upon written notice to the Franchisee. If any provision of this Agreement is held unenforceable, the remaining provisions shall continue in full force and effect. This Agreement may be executed in counterparts, including electronically, each of which shall be treated as an original.",
    ],
  },
];
