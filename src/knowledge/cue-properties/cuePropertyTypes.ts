export interface CueTypeEntry {
  readonly label: string;
  readonly uniqueProperties: readonly string[];
  readonly shapes?: readonly ParametricImageShape[];
}

export interface ParametricImageShape {
  readonly label: string;
  readonly uniqueProperties: readonly string[];
}
