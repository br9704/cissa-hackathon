/*
  The product's icon set.

  These were line drawn SVG paths, which is the default look every dashboard has, and the
  owner's direction was a bespoke pixel idiom. They are now thin wrappers over PixelIcon so
  the whole set is authored in one readable file as twelve by twelve grids.

  The EXPORT NAMES are unchanged deliberately. AppShell imports these six by name, and
  swapping the drawing style behind a stable interface means the nav did not have to change
  at all, which keeps this diff about the icons rather than about the shell.
*/
import { PixelIcon, type GlyphName } from "./pixel/PixelIcon";

type P = { size?: number };

const icon = (name: GlyphName) =>
  function Icon({ size = 20 }: P) {
    return <PixelIcon name={name} size={size} />;
  };

/* The ledger: a bound record, ruled. */
export const LedgerIcon = icon("record");
/* Genealogy: one decision and the two that came out of it. */
export const StrategyIcon = icon("graph");
/* Knowledge risk is a question of time: how long before the reasoning is gone. */
export const RiskIcon = icon("clock");
export const DebriefIcon = icon("chat");
/* A seal rather than a second page. A page beside the ledger glyph reads as a duplicate at
   20px, which is the size that actually ships. */
export const ComplianceIcon = icon("seal");
export const VerifyIcon = icon("shield");
export const MyRecordIcon = icon("person");

/* Newer surfaces, exported under their own names rather than aliased onto the six above. */
export const CaptureIcon = icon("inbox");
/* The daily surface. A person, because the desk is arranged around who is looking. */
export const DeskIcon = icon("people");
/* The architecture. A datastore, because the spine is the thing worth drawing. */
export const SystemIcon = icon("database");
export const RecordMeetingIcon = icon("mic");
export const ImportIcon = icon("upload");
export const NoteIcon = icon("note");
export const RepoIcon = icon("repo");
export const ModelIcon = icon("chip");
export const SearchIcon = icon("search");
export const AcademyIcon = icon("academy");
export const ReplayIcon = icon("rewind");
export const LinkIcon = icon("link");
export const BookIcon = icon("book");
export const PeopleIcon = icon("people");
export const WaveformIcon = icon("waveform");
export const SparkIcon = icon("spark");
