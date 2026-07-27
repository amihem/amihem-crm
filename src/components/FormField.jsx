export function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="font-medium text-ink/80">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "border border-line rounded-lg px-3 py-2 text-sm bg-white focus:border-ink2 outline-none w-full";

export function TextInput(props) {
  return <input {...props} className={`${inputClass} ${props.className || ""}`} />;
}

export function Select({ options, ...props }) {
  return (
    <select {...props} className={`${inputClass} ${props.className || ""}`}>
      {props.placeholder && <option value="">{props.placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function TextArea(props) {
  return <textarea {...props} rows={props.rows || 3} className={`${inputClass} ${props.className || ""}`} />;
}
