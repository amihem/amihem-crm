import { useState } from "react";
import { computeFabricWeights } from "../utils/fabricWeight";
import { Field, TextInput, Select } from "./FormField.jsx";

const UNITS = [
  { key: "gsm", label: "GSM (g/m²)" },
  { key: "glm", label: "GLM (g/linear m)" },
  { key: "oz", label: "OZ (oz/yd²)" },
];

// Props: width (string, inches), gsm (string, the canonical stored value),
// onChangeWidth(val), onChangeGsm(val) — most callers (Product Master)
// only store GSM as canonical and this is just a convenience way to get
// there. onChangeAll(result) is optional — pass it when you need all
// three values persisted separately (e.g. Price List, which keeps
// GLM/GSM/OZ as distinct columns straight from a mill's rate sheet).
export default function FabricWeightFields({ width, gsm, onChangeWidth, onChangeGsm, onChangeAll }) {
  const [inputUnit, setInputUnit] = useState("gsm");
  const [inputValue, setInputValue] = useState(gsm || "");

  const computed = computeFabricWeights(inputValue, inputUnit, width);

  const applyResult = (result) => {
    if (result.gsm !== null) onChangeGsm?.(String(result.gsm));
    if (result.gsm !== null) onChangeAll?.(result);
  };

  const handleValueChange = (val) => {
    setInputValue(val);
    applyResult(computeFabricWeights(val, inputUnit, width));
  };

  const handleUnitChange = (unit) => {
    setInputUnit(unit);
    applyResult(computeFabricWeights(inputValue, unit, width));
  };

  const handleWidthChange = (val) => {
    onChangeWidth(val);
    applyResult(computeFabricWeights(inputValue, inputUnit, val));
  };

  return (
    <div className="sm:col-span-2 border border-line rounded-lg p-3 flex flex-col gap-3">
      <div className="text-xs font-semibold text-ink/70">Fabric Weight — enter any one, others auto-calculate</div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Width (inch)">
          <TextInput value={width} onChange={(e) => handleWidthChange(e.target.value)} placeholder="e.g. 58" />
        </Field>
        <Field label="Enter weight as">
          <Select options={UNITS.map((u) => u.label)} value={UNITS.find((u) => u.key === inputUnit)?.label}
            onChange={(e) => handleUnitChange(UNITS.find((u) => u.label === e.target.value)?.key)} />
        </Field>
        <Field label="Value">
          <TextInput type="number" value={inputValue} onChange={(e) => handleValueChange(e.target.value)} placeholder="e.g. 220" />
        </Field>
      </div>
      <div className="flex gap-4 text-xs text-muted">
        <span>GSM: <strong className="text-ink">{computed.gsm ?? "—"}</strong></span>
        <span>GLM: <strong className="text-ink">{computed.glm ?? (width ? "—" : "needs width")}</strong></span>
        <span>OZ: <strong className="text-ink">{computed.oz ?? "—"}</strong></span>
      </div>
    </div>
  );
}
