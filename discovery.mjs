// Public learning pages. Generated as HTML and Markdown from the same reviewed copy.
// These are useful documentation formats, not a promise of search rankings.
// Load server schemas only for the website build; offline/artifact builds
// must not acquire a dependency on server configuration.
let TOOLS;

const ORIGIN = "https://kitchenstudio.design";
const REVIEWED = "2026-10-15";
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export const pages = [
  {
    path: "/guides/", title: "Commercial kitchen planning guides",
    description: "Practical guides for measuring a commercial kitchen, preparing an equipment layout and reviewing a supplier handoff.",
    answer: "Start with a measured room and the work your menu creates. These guides help café and QSR operators prepare a kitchen concept and an equipment schedule to review with suppliers before ordering.",
    sections: [
      { heading: "Plan the room before choosing the equipment", text: "A useful kitchen concept connects the room, the menu and the way food moves. Start with the layout checklist, then use the equipment-schedule guide to prepare the questions your supplier needs to answer." },
      { heading: "Choose your next task", links: [["Commercial kitchen layout checklist", "/guides/commercial-kitchen-layout/"], ["Equipment schedule and supplier handoff", "/guides/equipment-schedule/"], ["Kitchen Studio capabilities and limits", "/docs/"]] },
      { heading: "Using an AI assistant", text: "If your assistant supports remote MCP, the integration documentation describes the available tools and the account connection. Drawing exports remain a task in the visual editor.", links: [["AI integration documentation", "/docs/ai/"]] }
    ]
  },
  {
    path: "/guides/commercial-kitchen-layout/", title: "Commercial kitchen layout checklist for a café or QSR",
    description: "Turn a measured room, menu workflow and exact equipment list into a kitchen concept for supplier review.",
    answer: "To plan a commercial kitchen, measure the usable room, map the menu workflow, select exact equipment variants and check access before ordering. Kitchen Studio helps you draw and review that concept; installation, building services and approvals need qualified review.",
    sections: [
      { heading: "1. Capture the room you actually have", text: "Record internal wall lengths, ceiling constraints, doors and their swings, columns, windows and existing service points. Keep a measured distance as the reference when importing a floor-plan image. A screenshot with no known dimension is not a reliable scale.", bullets: ["Use one unit throughout the working plan; Kitchen Studio uses millimetres.", "Separate fixed obstacles from features that a landlord may allow you to change.", "Record uncertain measurements and confirm them on site before equipment decisions."] },
      { heading: "2. Map what the menu asks the kitchen to do", text: "List receiving, storage, prep, cooking, finishing, pickup and washing. Trace the movement of ingredients, finished food, dirty equipment and people. For a café, check the back-bar and dish return as carefully as the cook line. For delivery, include packing materials and the pickup handoff.", bullets: ["Identify the busiest process and the equipment that depends on it.", "Show where containers, packaging and dirty utensils wait.", "Treat expected order volume as an input to review, not proof that a layout can achieve that throughput."] },
      { heading: "3. Select the exact equipment variant", text: "Use a manufacturer, model and market or electrical variant rather than a generic rectangle. Record width, depth, height and the source document. Body dimensions do not establish the space needed for a handle, an open door, maintenance, ventilation or installation accessories. Unknown data should stay unknown until the supplier confirms it." },
      { heading: "4. Inspect the working space", text: "Check door access, people passing, loading and unloading, landing space beside equipment and the route to washing. Review countertop units together with their supporting tables or stands. Sketch the full installed arrangement for ovens, stands and accessories. A visual fit or a software overlap check does not establish code compliance or a workable shift.", bullets: ["Open equipment doors in the review, using the actual supplier information.", "Ask the installer to confirm hood coverage, extraction and service access.", "Have the design team establish the required aisle and access dimensions for the actual project."] },
      { heading: "5. Build the concept in Kitchen Studio", text: "Open the editor, set the room dimensions or calibrate and trace the floor plan, place relevant equipment and fabricated items, then inspect the plan and available views. Make an intentional save or export and verify the result. Start with your own room rather than treating an untouched example as a finished plan.", links: [["Open the studio", "/app/"], ["Read the product documentation", "/docs/"]] },
      { heading: "6. Review the handoff before ordering", text: "Send the concept, numbered equipment schedule and open questions to your supplier or fabricator. Ask them to confirm exact models, installation requirements, utilities, clearances and the drawing revision. Resolve their corrections before using the documents for a purchasing or fit-out decision.", links: [["Prepare the equipment schedule", "/guides/equipment-schedule/"]] }
    ]
  },
  {
    path: "/guides/equipment-schedule/", title: "How to prepare a kitchen equipment schedule for supplier review",
    description: "The equipment fields, utility questions and unresolved assumptions to include in a commercial kitchen supplier handoff.",
    answer: "A kitchen equipment schedule connects each numbered item on the layout to its exact model, dimensions, quantity and known service requirements. Send it with the drawing revision and a list of unresolved questions so the supplier can check the concept before quoting or ordering.",
    sections: [
      { heading: "Keep the layout and schedule connected", text: "Give every item a stable reference that matches the drawing. Include the room or project name, revision and date. If the layout changes, issue the matching schedule rather than asking a supplier to reconcile two different versions." },
      { heading: "Fields to review for each item", table: {
        headers: ["Field", "What the supplier should confirm"],
        rows: [["Item number and quantity", "The item on this exact drawing revision and the number required."], ["Manufacturer, model and variant", "The orderable model, market, electrical or gas version and included accessories."], ["Width, depth and height in mm", "Body size plus separate installed, operating and maintenance envelopes."], ["Power and services", "Published load, supply requirements, water and drainage; unknown fields remain unconfirmed."], ["Specification source", "Manufacturer document or supplier confirmation, with date or revision."], ["Fabricated details", "Size, material choice, bowl or drainer arrangement, upstand, shelf and accessory details."], ["Exceptions", "Missing data, alternatives and decisions required before a quote or purchase."]]
      } },
      { heading: "Separate unknown from none", text: "An empty load or drain field does not mean no connection is required. Label missing information as unconfirmed. Published equipment kW is not an engineered electrical demand calculation, and a service symbol does not locate a build-ready connection. Ask the relevant installer or engineer to establish the project requirements." },
      { heading: "Give a fabricator enough information to ask the right questions", text: "For a stainless table, record the dimensions and selected details such as an upstand, undershelf, drawer or castors. For a sink, include the bowl and drainer arrangement. Note interfaces with walls, neighbouring equipment and services. Material, construction, loading and installation details still require the fabricator's confirmation." },
      { heading: "Export and inspect the actual result", text: "Kitchen Studio's visual editor contains CSV, SVG and drawing-set PDF exports. Inspect the downloaded output against the layout and keep the unresolved assumptions beside it. The MCP integration can return the equipment schedule; it does not export the drawing files.", links: [["Open the editor", "/app/"], ["See the capability boundaries", "/docs/"]] },
      { heading: "Ask for a useful supplier response", bullets: ["Which models and variants can you supply, and what differs from this schedule?", "Which dimensions, services, accessories and clearances need correcting?", "Which fabricated details are insufficient for your quote or shop drawings?", "Which revision did you review, and what remains open?"], text: "A concrete correction, quote request or revision advances the project. Receiving a file alone does not establish that the handoff was useful." }
    ]
  },
  {
    path: "/docs/", title: "Kitchen Studio documentation and capability limits",
    description: "Understand Kitchen Studio's editor, equipment data, drawing exports, account features and AI integration boundaries.",
    answer: "Kitchen Studio is a commercial kitchen concept planner for operators. It combines real-size equipment, fabricated items and layout views with drawing exports for supplier or fabricator review. Use the editor to inspect the result and confirm equipment and installation details with the people delivering your project.",
    sections: [
      { heading: "A practical starting workflow", bullets: ["Enter your room dimensions, or import a floor plan and calibrate it against a known measurement.", "Place relevant catalogue equipment, custom equipment and fabricated items.", "Inspect the plan, elevations and 3D views; review access and unresolved assumptions.", "Intentionally save or export the concept, reopen or inspect it, and review the matching schedule with your supplier."] },
      { heading: "Equipment information", text: "Catalogue entries identify branded models and dimensional and service fields. Verify the exact selected model and variant against its source and supplier. Coverage and evidence differ by item; an entry in the catalogue is not a certification that every installation detail is complete. Custom and fabricated items need their own project-specific review." },
      { heading: "Saving and sharing", text: "The editor supports browser-local work and account-backed kitchens. Check the save state and reopen the intended project to verify important work. Use sharing intentionally and only for material you want the recipient to see. Public learning pages and documentation do not include customer kitchens." },
      { heading: "Outputs and review boundaries", table: {headers: ["Output", "Intended review"], rows: [["Plan and views", "Equipment arrangement and spatial discussion."], ["Equipment schedule", "Exact items, dimensions, known loads and questions for the supplier."], ["Fabrication detail sheets", "Selected dimensions and details for fabricator discussion."], ["PDF, SVG and CSV exports", "A reviewable concept package from the visual editor."]]}, text: "These outputs do not replace architectural, structural, MEP, fire, food-safety or authority-approved design. They do not prove capacity, throughput or regulatory compliance." },
      { heading: "AI and agent access", text: "The repository includes a remote MCP integration for account-scoped kitchen and catalogue tools. Client compatibility and a successful authenticated workflow must be verified in the actual client. Drawing exports remain in the editor.", links: [["Read the AI integration reference", "/docs/ai/"], ["Open connection instructions", "/connect/"]] },
      { heading: "Continue planning", links: [["Layout checklist", "/guides/commercial-kitchen-layout/"], ["Equipment schedule guide", "/guides/equipment-schedule/"], ["Open the studio", "/app/"]] }
    ]
  },
  {
    path: "/docs/ai/", title: "Kitchen Studio MCP tool reference for AI assistants",
    description: "Discover Kitchen Studio's MCP endpoint, account connection, coordinate system, available tool schemas and export limits.",
    answer: "Kitchen Studio's MCP integration exposes equipment search, account-scoped kitchen editing, layout checks and equipment schedules. Use https://kitchenstudio.design/mcp with a compatible remote MCP client and the account connection flow. Review the kitchen visually; PDF, SVG and CSV drawing exports are made in the editor.",
    sections: [
      { heading: "Connection and access", text: "Endpoint: https://kitchenstudio.design/mcp. The implementation uses bearer-token account authorization through the connection flow. A URL in the documentation does not establish that a particular client is connected or that its authenticated session succeeds. Test the intended client before depending on automated project work.", links: [["Account connection instructions", "/connect/"], ["Download current tool schemas", "/docs/ai/tools.json"]] },
      { heading: "Units and coordinates", text: "Use millimetres. The inside north-west corner is the origin: x increases east, y increases south. Catalogue keys identify the model selected by search_equipment. Preserve exact equipment dimensions rather than resizing a branded model to force a fit." },
      { heading: "Equipment from quotations", text: "Share the source document with your chosen MCP agent. Ask it to send equipment fields to prepare_equipment, resolve missing details and catalogue conflicts, then add_items to your selected kitchen and run check_layout. Preparation writes nothing; unknown utilities remain unknown and custom equipment stays unverified. Kitchen Studio does not call a model API. For software-only intake, upload the quotation in the desktop editor." },
      { heading: "Available tools", tools: true },
      { heading: "A small workflow to verify", bullets: ["Connect the intended account and list its kitchens, or create a separate test kitchen with known room dimensions.", "Search for exact equipment, add the selected items and inspect the returned layout checks.", "Open the result in the editor, compare dimensions and confirm the saved project is the intended one.", "Retrieve its schedule and use the visual editor for drawing exports.", "Exercise missing-model, impossible-fit, retry and concurrent-edit cases before promising unattended operation."] },
      { heading: "Integration boundaries", text: "The machine-readable reference is generated from the same exported tool definitions as the server. Local schema and test results describe the reviewed source; they do not establish a successful deployed or external-client session. Keep unknown equipment services and installation requirements explicit. The integration does not provide engineering approval, payment processing or drawing-file exports." }
    ]
  }
];

const toolRows = () => TOOLS.map(t => [t.name, t.description]);
const markdown = p => [
  `# ${p.title}`, "", p.answer, "", `Reviewed ${REVIEWED}.`, "",
  ...p.sections.flatMap(s => [
    `## ${s.heading}`, "", ...(s.text ? [s.text, ""] : []),
    ...(s.bullets ? [...s.bullets.map(x => `- ${x}`), ""] : []),
    ...(s.table ? [`| ${s.table.headers.join(" | ")} |`, `| ${s.table.headers.map(() => "---").join(" | ")} |`, ...s.table.rows.map(row => `| ${row.join(" | ")} |`), ""] : []),
    ...(s.tools ? ["| Tool | Purpose |", "| --- | --- |", ...toolRows().map(row => `| ${row.map(x => x.replaceAll("|", "\\|")).join(" | ")} |`), ""] : []),
    ...(s.links ? [...s.links.map(([label,url]) => `- [${label}](${url})`), ""] : [])
  ]),
  "Open Kitchen Studio: https://kitchenstudio.design/app/", ""
].join("\n");

const table = (headers, rows, tools = false) => `<div class="table-wrap"><table${tools ? ' class="tools"' : ''}><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const sections = p => p.sections.map(s => `<section><h2>${esc(s.heading)}</h2>${s.text?`<p>${esc(s.text)}</p>`:""}${s.bullets?`<ul>${s.bullets.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}${s.table?table(s.table.headers,s.table.rows):""}${s.tools?table(["Tool","Purpose"],toolRows(),true):""}${s.links?`<ul>${s.links.map(([label,url])=>`<li><a href="${esc(url)}">${esc(label)}</a></li>`).join("")}</ul>`:""}</section>`).join("\n");

function html(p) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)} | Kitchen Studio</title><meta name="description" content="${esc(p.description)}"><link rel="canonical" href="${ORIGIN}${p.path}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta name="theme-color" content="#F0602F"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap"><link rel="alternate" type="text/markdown" href="${p.path}index.md" title="Markdown version"><style>
  :root{color-scheme:light dark;--bg:#f2f4f7;--paper:#fff;--ink:#17202a;--muted:#56616e;--line:#dce2e8;--accent:#b63e16}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 "Manrope",system-ui,sans-serif}a{color:var(--accent);text-underline-offset:3px}header,main,footer{max-width:900px;margin:auto;padding:24px}header{display:flex;align-items:center;justify-content:space-between;gap:16px}header .brand{display:flex;gap:10px;align-items:center;color:var(--ink);text-decoration:none;font-weight:750}header .mark{width:36px;height:36px;flex:none}header nav{display:flex;gap:16px;flex-wrap:wrap;font-size:14px}main{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:clamp(22px,5vw,56px);margin-top:8px}h1{font-size:clamp(30px,5vw,46px);line-height:1.12;letter-spacing:-.035em;margin:12px 0 24px}h2{font-size:24px;line-height:1.25;margin:0 0 14px}p{margin:0 0 18px}.answer{font-size:20px;line-height:1.6}.meta,footer{font-size:13px;color:var(--muted)}section{margin-top:36px}li{margin:8px 0}ul{padding-left:24px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:15px;text-align:left}th,td{vertical-align:top;padding:12px;border-bottom:1px solid var(--line);overflow-wrap:anywhere}th{font-weight:700}td:first-child{min-width:145px}.tools td:first-child{white-space:nowrap;min-width:210px;font-family:"IBM Plex Mono",ui-monospace,monospace}.cta{display:inline-block;padding:11px 20px;background:var(--accent);color:#fff;border-radius:999px;text-decoration:none;font-weight:700;margin-top:16px}.skip{position:absolute;left:-9999px}.skip:focus{left:16px;top:8px;background:var(--paper);padding:8px}footer{display:flex;flex-wrap:wrap;gap:12px 24px;padding-bottom:40px}@media(prefers-color-scheme:dark){:root{--bg:#0e1318;--paper:#171d24;--ink:#e7ecf1;--muted:#aab5c1;--line:#34414f;--accent:#ff9b73}.cta{color:#17202a}}@media(max-width:420px){header{padding:18px 16px;align-items:flex-start}header nav{gap:8px 12px;max-width:125px}header .brand span{max-width:95px;line-height:1.15}main{border-radius:0;border-left:0;border-right:0;margin:0}.answer{font-size:18px}th,td{padding:10px}}
  </style></head><body><a class="skip" href="#main">Skip to content</a><header><a class="brand" href="/">__KS_BRAND_MARK__<span>kitchen studio</span></a><nav aria-label="Main"><a href="/guides/">Guides</a><a href="/docs/">Docs</a><a href="/app/">Open studio</a></nav></header><main id="main"><p class="meta">Kitchen Studio planning resources · Reviewed <time datetime="${REVIEWED}">${REVIEWED}</time></p><h1>${esc(p.title)}</h1><p class="answer">${esc(p.answer)}</p>${sections(p)}<a class="cta" href="/app/">Plan your own kitchen</a></main><footer><a href="/guides/">Planning guides</a><a href="/docs/">Product documentation</a><a href="${p.path}index.md">Read as Markdown</a><span>Concepts for supplier review. Confirm project requirements before ordering.</span></footer></body></html>`;
}

export async function buildDiscovery(write, branded) {
  ({ TOOLS } = await import("./mcp.js"));
  for (const p of pages) {
    write(p.path.slice(1)+"index.html",branded(html(p)));
    write(p.path.slice(1)+"index.md",markdown(p));
  }
  write("docs/ai/tools.json",JSON.stringify({source:"Kitchen Studio MCP exported TOOLS",reviewed:REVIEWED,tools:TOOLS},null,2)+"\n");
  const urls=["/","/app/","/connect/",...pages.map(p=>p.path)];
  write("sitemap.xml",`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(p=>`  <url><loc>${ORIGIN}${p}</loc></url>`).join("\n")}\n</urlset>\n`);
  write("llms.txt",`# Kitchen Studio\n\n> Commercial kitchen concepts for supplier and fabricator review.\n\n## Guides and documentation\n${pages.map(p=>`- [${p.title}](${ORIGIN}${p.path}index.md): ${p.description}`).join("\n")}\n\n## Tools\n- [MCP schemas](${ORIGIN}/docs/ai/tools.json): Source-generated tool reference; account connection and client verification required.\n- [Connection](${ORIGIN}/connect/): Connection instructions.\n\nDrawings are exported in the visual editor. Unknown equipment or installation data need supplier confirmation.\n`);
  write("llms-full.txt",pages.map(markdown).join("\n---\n\n"));
}
