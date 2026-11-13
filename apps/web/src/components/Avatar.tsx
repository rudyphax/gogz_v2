export function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (url)
    return <img src={url} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  return (
    <span
      aria-hidden
      style={style}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-blue-700 font-bold text-white"
    >
      {initials || '?'}
    </span>
  );
}
