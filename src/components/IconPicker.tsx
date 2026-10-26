export function IconPicker({
  name,
  icons,
  defaultValue,
  idPrefix,
}: {
  name: string;
  icons: string[];
  defaultValue?: string;
  idPrefix: string;
}) {
  return (
    <div className="icon-select">
      {icons.map((icon) => (
        <span key={icon}>
          <input type="radio" name={name} value={icon} id={`${idPrefix}-${icon}`} defaultChecked={icon === defaultValue} />
          <label htmlFor={`${idPrefix}-${icon}`} title={icon.replace("fa-", "")}>
            <i className={`fas ${icon}`} />
          </label>
        </span>
      ))}
    </div>
  );
}
