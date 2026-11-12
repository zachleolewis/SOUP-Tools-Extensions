// Stat Card: a Boards card that shows one number from a column of the data it is given. One definition, registered once; Boards
// draws the settings panel from `optionSpecs`, so the card has no settings UI of its own. Guide: docs/20-cards.md.
import { Plugin, type BoardsApi, type CardDefinition, type CardViewProps } from "soup";
import { MEASURES, firstNumberColumn, measure, show, type Measure } from "./logic";

interface Options {
  column: string | null;
  measure: Measure;
  decimals: number;
}

const docs = `# Stat Card

**What it answers:** how big one number is (the rounds played, the average damage).

**How to read it:** the big number is the chosen measure of the chosen column over every row on the card; under it is the measure and the column's name.

**Click:** the card selects nothing.

**Settings:**

| Setting | What it does |
|---|---|
| Column | The number column that is measured |
| Measure | Total, average, highest or lowest |
| Decimals | How many decimals the number shows |
`;

function Icon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2 13h12M4 13V8m4 5V3m4 10V6" />
    </svg>
  );
}

// Colours come from SOUP's theme variables, so a custom palette recolours the card. SOUP's own CSS classes are not API.
const centre = { display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", padding: "0 16px", gap: 6 } as const;
const small = { margin: 0, fontFamily: "monospace", fontSize: 11, color: "hsl(var(--foreground) / 0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

function Stat({ frame, options, openSettings }: CardViewProps<Options>) {
  const value = measure(frame, options.column, options.measure);
  if (options.column === null || value === null)
    return (
      <div style={{ ...centre, alignItems: "center", textAlign: "center" }}>
        <p style={small}>{options.column === null ? "Choose a number column." : "That column has no numbers."}</p>
        <button style={{ border: "2px solid hsl(var(--forest-700))", background: "none", color: "inherit", padding: "4px 8px", fontFamily: "monospace", fontSize: 11 }} onClick={openSettings}>
          Open card settings
        </button>
      </div>
    );
  const label = MEASURES.find(([key]) => key === options.measure)?.[1] ?? options.measure;
  return (
    <div style={centre}>
      <p style={{ margin: 0, fontSize: 48, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "hsl(var(--forest-300))" }}>
        {show(value, options.decimals)}
      </p>
      <p style={small}>
        {label} of {options.column}
      </p>
    </div>
  );
}

const card: CardDefinition<Options> = {
  id: "stat-card.number",
  label: "Stat",
  icon: Icon,
  description: "One number from a column: total, average, highest or lowest",
  group: "Tables and numbers",
  needs: { tier: "match" },
  version: 0,
  defaultOptions: { column: null, measure: "total", decimals: 0 },
  optionSpecs: [
    { key: "column", label: "Column", type: "column", kind: "number", auto: true },
    { key: "measure", label: "Measure", type: "select", choices: MEASURES },
    { key: "decimals", label: "Decimals", type: "number", min: 0, max: 3, step: 1, section: "Style" },
  ],
  autoOptions: (frame) => ({ column: firstNumberColumn(frame) }),
  defaultSize: { width: 240, height: 160 },
  component: Stat,
  docs,
  sample: () => ({
    columns: ["Player", "Rounds"],
    rows: [["Aster", 210], ["Brook", 188], ["Cinder", 240], ["Dune", 96]],
  }),
};

export default class StatCard extends Plugin {
  onload() {
    const boards = this.app.modules.get<BoardsApi>("boards");
    if (!boards) return;
    this.register(boards.registerCard(card));
  }
}
