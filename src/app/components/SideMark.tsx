interface Props {
  side: "ocean" | "land";
}

/**
 * Small square that keys a label to one side of the comparison: International
 * Orange for Panthalassa (ocean), Cod Gray for Terrestrial (land). Decorative; the
 * label text next to it carries the meaning.
 */
export function SideMark({ side }: Props) {
  return <span className={`side-mark side-mark-${side}`} aria-hidden="true" />;
}
