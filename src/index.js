import { defmatch, match, MatchError, Clause, clause } from "./tailored/defmatch";
import { variable, wildcard, startsWith, capture, headTail, type, bound, bitStringMatch } from "./tailored/types";


export default {
  defmatch, match, MatchError,
  variable, wildcard, startsWith,
  capture, headTail, type, bound, Clause, clause, bitStringMatch
};
