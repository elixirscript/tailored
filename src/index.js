import { defmatch, match, MatchError, Clause, clause, match_or_default, defmatchgen } from "./tailored/defmatch";
import { variable, wildcard, startsWith, capture, headTail, type, bound, bitStringMatch } from "./tailored/types";


export default {
  defmatch, match, MatchError,
  variable, wildcard, startsWith,
  capture, headTail, type, bound,
  Clause, clause, bitStringMatch,
  match_or_default, defmatchgen
};
